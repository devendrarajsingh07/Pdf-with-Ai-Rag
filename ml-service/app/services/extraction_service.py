import pymupdf as fitz
import pdfplumber
import pytesseract
from PIL import Image, ImageOps
import io
import shutil
import re
from pathlib import Path
from typing import Optional
from loguru import logger
from app.core.config import settings
from app.services.structured_ocr import structured_ocr

class ExtractionService:
    def __init__(self) -> None:
        configured = settings.tesseract_cmd.strip()
        local_tesseract = (
            Path(__file__).resolve().parents[3] / ".tools" / "tesseract-ocr" / "tesseract.exe"
        )
        executable = configured or shutil.which("tesseract")
        if not executable and local_tesseract.exists():
            executable = str(local_tesseract)
        if executable:
            pytesseract.pytesseract.tesseract_cmd = executable

    def extract(self, file_path: str) -> dict:
        """Extract text from PDF. Returns {pages: [...], metadata: {...}, total_pages: int}"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF not found: {file_path}")
        
        pages = []
        metadata = {}
        
        try:
            doc = fitz.open(str(path))
            metadata = {
                'title': doc.metadata.get('title', ''),
                'author': doc.metadata.get('author', ''),
                'total_pages': len(doc)
            }
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                native = page.get_text('text', sort=True).strip()
                # PDF tables often serialize all column labels before all values.
                # Recover exact railway PNR numbers from native word coordinates.
                fields = self._native_pnr_fields(page)
                if fields:
                    native += '\n' + '\n'.join(f'PNR: {number}' for number in fields)
                text = native
                image_area = sum(fitz.Rect(image['bbox']).get_area() for image in page.get_image_info())
                coverage = min(1, image_area / max(1, page.rect.get_area()))
                ocr = None
                
                if settings.ocr_backend != 'tesseract' or len(text) < 50 or coverage > 0.15 or '\ufffd' in text:
                    ocr = self._extract_with_ocr(page)
                    method = 'pymupdf'
                    if ocr['text'] and len(native) < 50 and len(ocr['text']) > len(native):
                        text, method = ocr['text'], 'ocr'
                    elif ocr['text'] and coverage > 0.15:
                        known = {' '.join(line.lower().split()) for line in native.splitlines()}
                        extra = [line for line in ocr['text'].splitlines()
                                 if ' '.join(line.lower().split()) not in known]
                        text = '\n'.join([native, *extra]).strip()
                        method = 'hybrid' if native else 'ocr'
                else:
                    method = 'pymupdf'
                
                pages.append({
                    'page_number': page_num + 1,
                    'text': text,
                    'has_text': bool(text),
                    'extraction_method': method,
                    'structure': ocr.get('structure') if ocr else None,
                    'originalReading': ocr.get('originalReading') if ocr else None,
                    'metrics': {
                        'nativeCharacters': len(native), 'extractedCharacters': len(text),
                        'imageCoverage': round(coverage, 3), 'ocrAttempted': ocr is not None,
                        'ocrConfidence': ocr['confidence'] if ocr else None,
                        'ocrWords': ocr['words'] if ocr else 0,
                        'lowConfidenceWords': ocr['low_words'] if ocr else 0,
                        'ocrBackend': ocr.get('backend', 'tesseract') if ocr else None,
                        'enhancementApplied': ocr.get('enhancementApplied', False) if ocr else False,
                        'checkpointSha256': ocr.get('checkpointSha256') if ocr else None,
                        'warnings': (ocr.get('warnings', []) if ocr else [])
                        + (['OCR failed; native text retained'] if ocr and ocr.get('error') else [])
                        + (['Low OCR confidence; verify dates and identifiers']
                           if ocr and ocr['confidence'] is not None and ocr['confidence'] < 70 else [])
                        + (['No readable text found'] if not text else [])
                    }
                })
            
            doc.close()
        except Exception as e:
            logger.warning(f"PyMuPDF failed, trying pdfplumber: {e}")
            pages = self._extract_with_pdfplumber(str(path))
            metadata['total_pages'] = len(pages)
        
        return {'pages': pages, 'metadata': metadata, 'total_pages': len(pages)}

    @staticmethod
    def _native_pnr_fields(page) -> list[str]:
        words = page.get_text('words')
        labels = [word for word in words if re.fullmatch(r'PNR(?:No\.?)?:?', word[4], re.I)]
        values = [word for word in words if re.fullmatch(r'\d{10}', word[4])]
        matches = []
        for label in labels:
            center = (label[0] + label[2]) / 2
            candidates = []
            for value in values:
                dx = abs((value[0] + value[2]) / 2 - center)
                dy = value[1] - label[1]
                below = 0 < dy < 100 and dx < 60
                inline = abs(dy) < 12 and 0 <= value[0] - label[2] < 160
                if below or inline:
                    candidates.append((dy + dx if below else value[0] - label[2], value[4]))
            candidates.sort()
            if candidates and (len(candidates) == 1 or candidates[1][0] - candidates[0][0] > 10):
                matches.append(candidates[0][1])
        return list(dict.fromkeys(matches))
    
    def _extract_with_ocr(self, page) -> dict:
        if settings.ocr_backend != 'tesseract':
            try:
                scale = min(300 / 72, (16_000_000 / max(1, page.rect.get_area())) ** 0.5)
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
                image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
                result = structured_ocr.read(image)
                if result['text']:
                    return result
            except Exception:
                logger.exception('Structured OCR unavailable; trying Tesseract')
            result = self._extract_with_tesseract(page)
            result['backend'] = 'tesseract'
            result['warnings'] = ['docTR unavailable or empty; Tesseract fallback used']
            return result
        return self._extract_with_tesseract(page)

    def _extract_with_tesseract(self, page) -> dict:
        try:
            scale = min(300 / 72, (16_000_000 / max(1, page.rect.get_area())) ** 0.5)
            mat = fitz.Matrix(scale, scale)
            clip = page.rect
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes('png')
            img = ImageOps.autocontrast(Image.open(io.BytesIO(img_data)).convert('L'))
            candidates = []
            for psm in (3, 6):
                data = pytesseract.image_to_data(img, config=f'--oem 3 --psm {psm}',
                                                output_type=pytesseract.Output.DICT, timeout=90)
                lines, scores = {}, []
                for i, word in enumerate(data['text']):
                    score = float(data['conf'][i])
                    if not word.strip() or score < 0:
                        continue
                    key = (data['block_num'][i], data['par_num'][i], data['line_num'][i])
                    lines.setdefault(key, []).append(word.strip())
                    scores.append(score)
                confidence = round(sum(scores) / len(scores), 1) if scores else None
                candidates.append({'text': '\n'.join(' '.join(words) for words in lines.values()),
                                   'confidence': confidence, 'words': len(scores),
                                   'low_words': sum(score < 70 for score in scores)})
                if confidence is not None and confidence >= 85:
                    break
            return max(candidates, key=lambda item: (item['confidence'] or 0, item['words']))
        except Exception as e:
            logger.warning(f"OCR failed for page: {e}")
            return {'text': '', 'confidence': None, 'words': 0, 'low_words': 0, 'error': True}
    
    def _extract_with_pdfplumber(self, path: str) -> list[dict]:
        pages = []
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = (page.extract_text() or '').strip()
                pages.append({
                    'page_number': i + 1,
                    'text': text,
                    'has_text': bool(text),
                    'extraction_method': 'pdfplumber',
                    'metrics': {'nativeCharacters': len(text), 'extractedCharacters': len(text),
                                'imageCoverage': None, 'ocrAttempted': False, 'ocrConfidence': None,
                                'ocrWords': 0, 'lowConfidenceWords': 0,
                                'warnings': ['Fallback extraction; OCR quality unavailable']}
                })
        return pages

extraction_service = ExtractionService()
