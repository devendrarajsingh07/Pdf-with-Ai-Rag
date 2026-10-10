from unittest.mock import Mock, patch
import json
import numpy as np
import pytest
from PIL import Image

from app.core.config import settings
from app.services.cgan_service import CGANService, tile_starts
from app.services.structured_ocr import StructuredOCR, export_reading, preservation_issues
from app.services.document_analysis import analyze_document
from app.services.extraction_service import ExtractionService


def reading(text='PNR: 2626554557', confidence=95):
    return {'text': text, 'confidence': confidence, 'words': 2, 'low_words': 0,
            'structure': {'blocks': []}, 'backend': 'doctr'}


def test_doctr_export_preserves_word_geometry():
    word = {'value': 'PNR', 'confidence': .95, 'geometry': [[.1, .2], [.3, .4]]}
    export = {'pages': [{'dimensions': [600, 800],
        'blocks': [{'lines': [{'words': [word]}]}]}]}
    result = export_reading(export)
    assert result['text'] == 'PNR' and result['confidence'] == 95
    assert result['structure']['blocks'][0]['lines'][0]['words'][0]['geometry'] == word['geometry']
    json.dumps(result)


@pytest.mark.parametrize('length', [1, 128, 256, 257, 512, 791])
def test_tiles_cover_every_pixel(length):
    starts = tile_starts(length, 256, 32)
    covered = set(i for start in starts for i in range(start, min(length, start + 256)))
    assert covered == set(range(length))
    assert starts == sorted(set(starts))


def test_changed_numbers_rejected_even_when_confident():
    assert preservation_issues(reading(), reading('PNR: 2626554558', 99))


def test_lost_text_rejected():
    assert preservation_issues(reading('one two three four five'), reading('one'))


def test_accepts_preserved_reading(monkeypatch):
    monkeypatch.setattr(settings, 'ocr_backend', 'cgan_doctr')
    service = StructuredOCR()
    service.gan.enhance = Mock(return_value=Image.new('RGB', (256, 256)))
    service.gan.checkpoint_digest = 'digest'
    with patch.object(service, '_predict', side_effect=[reading(confidence=90), reading()]):
        result = service.read(Image.new('RGB', (256, 256)))
    assert result['enhancementApplied'] and result['backend'] == 'cgan_doctr'
    assert result['originalReading']['text'] == 'PNR: 2626554557'


def test_rejects_changed_reading(monkeypatch):
    monkeypatch.setattr(settings, 'ocr_backend', 'cgan_doctr')
    service = StructuredOCR()
    service.gan.enhance = Mock(return_value=Image.new('RGB', (256, 256)))
    with patch.object(service, '_predict', side_effect=[reading(), reading('PNR: 2626554558', 99)]):
        result = service.read(Image.new('RGB', (256, 256)))
    assert not result['enhancementApplied'] and result['warnings']
    assert '2626554557' in result['text']


def test_missing_checkpoint_keeps_original(monkeypatch):
    monkeypatch.setattr(settings, 'ocr_backend', 'cgan_doctr')
    monkeypatch.setattr(settings, 'cgan_checkpoint', '')
    service = StructuredOCR()
    with patch.object(service, '_predict', return_value=reading()):
        result = service.read(Image.new('RGB', (256, 256)))
    assert not result['enhancementApplied'] and result['warnings']


def test_identity_generator_keeps_resolution_and_pixels(monkeypatch):
    import torch
    monkeypatch.setattr(settings, 'ocr_device', 'cpu')
    service = CGANService()
    service._generator = torch.nn.Identity()
    pixels = np.random.default_rng(1).integers(0, 256, (299, 517, 3), dtype=np.uint8)
    result = service.enhance(Image.fromarray(pixels))
    assert result.size == (517, 299)
    np.testing.assert_array_equal(np.asarray(result), pixels)


def test_tile_budget_checked_before_model_load(monkeypatch):
    monkeypatch.setattr(settings, 'cgan_max_tiles', 1)
    with pytest.raises(ValueError, match='tile budget'):
        CGANService().enhance(Image.new('RGB', (512, 512)))


def test_actual_upstream_state_dict_adapter(monkeypatch, tmp_path):
    # Random fixture weights validate compatibility only, never extraction quality.
    import importlib.util
    import hashlib
    from pathlib import Path
    import torch
    source = Path(settings.cgan_repo_dir).resolve() / 'models' / 'networks.py'
    if not source.exists():
        pytest.skip('Optional upstream source checkout not installed')
    spec = importlib.util.spec_from_file_location('test_cgan_networks', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    checkpoint = tmp_path / 'fixture.pth'
    generator = module.define_G(3, 3, 4, 'resnet_6blocks', norm='batch')
    torch.save(generator.state_dict(), checkpoint)
    monkeypatch.setattr(settings, 'cgan_checkpoint', str(checkpoint))
    monkeypatch.setattr(settings, 'cgan_checkpoint_sha256', hashlib.sha256(checkpoint.read_bytes()).hexdigest())
    monkeypatch.setattr(settings, 'cgan_net_g', 'resnet_6blocks')
    monkeypatch.setattr(settings, 'cgan_ngf', 4)
    monkeypatch.setattr(settings, 'ocr_device', 'cpu')
    result = CGANService().enhance(Image.new('RGB', (256, 256), 'white'))
    assert result.size == (256, 256)


def test_checkpoint_digest_mismatch(monkeypatch, tmp_path):
    file = tmp_path / 'not-a-checkpoint.pth'
    file.write_bytes(b'invalid')
    monkeypatch.setattr(settings, 'cgan_checkpoint', str(file))
    monkeypatch.setattr(settings, 'cgan_checkpoint_sha256', '0' * 64)
    with pytest.raises(ValueError, match='digest mismatch'):
        CGANService()._load()


def test_structured_layout_reaches_analysis(monkeypatch, tmp_path):
    import pymupdf as fitz
    monkeypatch.setattr(settings, 'ocr_backend', 'doctr')
    path = tmp_path / 'native.pdf'
    with fitz.open() as doc:
        doc.new_page().insert_text((72, 72), 'PNR: 2626554557')
        doc.save(path)
    with patch('app.services.extraction_service.structured_ocr.read', return_value=reading()):
        extracted = ExtractionService().extract(str(path))
    result = analyze_document(extracted['pages'])
    assert len(result['structuredPages']) == 1
    assert result['pages'][0]['ocrBackend'] == 'doctr'


def test_doctr_failure_uses_tesseract(monkeypatch):
    monkeypatch.setattr(settings, 'ocr_backend', 'doctr')
    import pymupdf as fitz
    with fitz.open() as doc:
        page = doc.new_page()
        service = ExtractionService()
        with patch('app.services.extraction_service.structured_ocr.read', side_effect=RuntimeError()), \
             patch.object(service, '_extract_with_tesseract', return_value=reading()):
            result = service._extract_with_ocr(page)
    assert result['backend'] == 'tesseract' and result['warnings']
