from app.services.document_analysis import analyze_document, expand_query
from app.services.extraction_service import ExtractionService
from app.rag.pipeline import RAGPipeline
from app.schemas.chat import ChatRequest
from unittest.mock import patch
import pymupdf as fitz
import pytest
from pathlib import Path


def page(text, number=1):
    return {'page_number': number, 'text': text, 'extraction_method': 'native', 'metrics': {}}


def test_entire_pdf_summary_dates_and_pnr():
    result = analyze_document([page('PNR No: 2626554557\nJourney date: 18 November 2026'),
                               page('Important payment deadline 2026-11-20.', 2)])
    assert len(result['summary']) == 2
    assert {date['text'] for date in result['dates']} == {'18 November 2026', '2026-11-20'}
    assert result['identifiers'][0]['value'] == '2626554557'
    assert result['totalTokens'] > 0


def test_pnr_request_uses_local_sources_without_gemini():
    with patch('app.rag.pipeline.qdrant_service.document_chunks', return_value=[{
        'document_id': 'doc', 'chunk_id': 'chunk', 'page_number': 2,
        'source_filename': 'ticket.pdf', 'text': 'PNR\n2626554557\nDate 08/10/2026',
    }]) as chunks, patch('app.rag.pipeline.llm_service.generate') as llm:
        response = RAGPipeline().run(ChatRequest(user_id='owner', conversation_id='session',
            question='check pnr', document_ids=['doc']))
    chunks.assert_called_once_with('owner', ['doc'])
    llm.assert_not_called()
    assert '2626554557' in response.answer
    assert 'not a live PNR status' in response.answer
    assert response.citations[0].page_number == 2


def test_query_expansion():
    assert 'Passenger Name Record' in expand_query('pnr details')
    assert expand_query('budget') == 'budget'


def test_native_short_text_survives_failed_ocr(tmp_path):
    file = tmp_path / 'short.pdf'
    with fitz.open() as doc:
        doc.new_page().insert_text((72, 72), 'PNR: 2626554557')
        doc.save(file)
    service = ExtractionService()
    with patch.object(service, '_extract_with_ocr', return_value={
        'text': '', 'confidence': None, 'words': 0, 'low_words': 0, 'error': True,
    }):
        result = service.extract(str(file))
    assert '2626554557' in result['pages'][0]['text']
    assert result['pages'][0]['metrics']['warnings']


def test_scanned_ticket_real_ocr(tmp_path):
    # A known, image-only reference validates recognition, not just confidence.
    from PIL import Image, ImageDraw, ImageFont
    import io
    image = Image.new('RGB', (1600, 600), 'white')
    draw = ImageDraw.Draw(image)
    fonts = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    font_path = next((font for font in fonts if Path(font).exists()), None)
    if font_path is None:
        pytest.skip('No test font available')
    font = ImageFont.truetype(font_path, 48)
    expected = 'PNR: 2626554557\nJourney date: 08/10/2026\nTrain: Aurora Express'
    draw.multiline_text((60, 60), expected, font=font, fill='black', spacing=20)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    file = tmp_path / 'scan.pdf'
    with fitz.open() as doc:
        doc.new_page(width=800, height=300).insert_image(fitz.Rect(0, 0, 800, 300), stream=buffer.getvalue())
        doc.save(file)
    result = ExtractionService().extract(str(file))
    text = result['pages'][0]['text']
    assert '2626554557' in text and '08/10/2026' in text
    assert result['pages'][0]['metrics']['ocrConfidence'] > 70
    assert analyze_document(result['pages'])['identifiers'][0]['value'] == '2626554557'


def test_table_pnr_and_hyphenated_dates(tmp_path):
    file = tmp_path / 'table.pdf'
    with fitz.open() as doc:
        page = doc.new_page()
        page.insert_text((72, 72), 'PNR')
        page.insert_text((200, 72), 'Train number')
        page.insert_text((72, 95), '2626554557')
        page.insert_text((200, 95), '12001')
        page.insert_text((72, 140), 'Journey 18-Nov-2026. Ticket reference report.')
        doc.save(file)
    result = ExtractionService().extract(str(file))
    analysis = analyze_document(result['pages'])
    assert analysis['identifiers'][0]['value'] == '2626554557'
    assert analysis['dates'][0]['text'] == '18-Nov-2026'
