"""Serialized, lazy docTR OCR plus optional guarded cGAN enhancement."""
from collections import Counter
from threading import RLock
import re

import numpy as np
from loguru import logger
from app.core.config import settings
from app.services.cgan_service import CGANService


def preservation_issues(original: dict, enhanced: dict) -> list[str]:
    """Heuristics, NOT proof of accuracy: reject lost words and changed numbers."""
    before = Counter(re.findall(r'\w+', original['text'].casefold()))
    after = Counter(re.findall(r'\w+', enhanced['text'].casefold()))
    issues = []
    if before and sum((before & after).values()) / sum(before.values()) < 0.8:
        issues.append('Enhanced OCR lost or changed more than 20% of original tokens')
    numbers = set(re.findall(r'\b\d[\d/.:\-]*\b', original['text']))
    if not numbers.issubset(set(re.findall(r'\b\d[\d/.:\-]*\b', enhanced['text']))):
        issues.append('Enhanced OCR changed or lost numeric fields; original reading retained')
    if not enhanced['text'].strip():
        issues.append('Enhanced OCR produced no readable text')
    return issues


def export_reading(export: dict) -> dict:
    pages = export.get('pages', [])
    if len(pages) != 1:
        raise ValueError('Expected exactly one OCR page')
    scores, lines = [], []
    for block in pages[0].get('blocks', []):
        for line in block.get('lines', []):
            words = line.get('words', [])
            lines.append(' '.join(word['value'] for word in words))
            scores.extend(float(word['confidence']) * 100 for word in words)
    return {'text': '\n'.join(lines).strip(),
            'confidence': round(sum(scores) / len(scores), 1) if scores else None,
            'words': len(scores), 'low_words': sum(score < 70 for score in scores),
            'structure': pages[0]}


class StructuredOCR:
    def __init__(self):
        self._model = None
        self._lock = RLock()
        self.gan = CGANService()

    def _predict(self, image):
        import torch
        from doctr.models import ocr_predictor
        if self._model is None:
            torch.set_num_threads(settings.ocr_torch_threads)
            self._model = ocr_predictor(det_arch='db_resnet50', reco_arch='crnn_vgg16_bn',
                pretrained=True, assume_straight_pages=True,
                preserve_aspect_ratio=True, symmetric_pad=True).to(settings.ocr_device).eval()
        # Equivalent to DocumentFile.from_images, without writing sensitive temp PNGs.
        with torch.inference_mode():
            result = self._model([np.asarray(image.convert('RGB'))])
        return export_reading(result.export())

    def read(self, image):
        with self._lock:
            original = self._predict(image)
            original.update(backend='doctr', enhancementApplied=False, warnings=[])
            if settings.ocr_backend != 'cgan_doctr':
                return original
            try:
                enhanced = self._predict(self.gan.enhance(image))
                issues = preservation_issues(original, enhanced)
                if issues:
                    original['warnings'].extend(issues)
                    return original
                # Confidence is diagnostic, not measured CER/WER. Never select a worse score.
                if (enhanced['confidence'] or 0) < (original['confidence'] or 0):
                    original['warnings'].append('Enhanced OCR confidence decreased; original retained')
                    return original
                enhanced.update(backend='cgan_doctr', enhancementApplied=True, warnings=[],
                    checkpointSha256=self.gan.checkpoint_digest,
                    originalReading={'text': original['text'], 'structure': original['structure']})
                return enhanced
            except Exception:
                logger.exception('cGAN enhancement unavailable; original docTR reading retained')
                original['warnings'].append('cGAN unavailable; original docTR reading retained')
                return original


structured_ocr = StructuredOCR()
