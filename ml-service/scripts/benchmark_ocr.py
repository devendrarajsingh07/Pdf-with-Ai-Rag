"""Opt-in neural OCR benchmark. Run from ml-service; no Gemini calls.

Manifest format: [{"image": "/path/page.png", "reference": "verified transcription"}].
Print aggregate quality metrics only, not document text. Images stay on disk unmodified.
"""
import argparse
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image, ImageDraw, ImageFont
from app.core.config import settings
from app.services.structured_ocr import structured_ocr


def distance(left, right):
    row = list(range(len(right) + 1))
    for i, a in enumerate(left, 1):
        previous, row = row, [i]
        for j, b in enumerate(right, 1):
            row.append(min(row[-1] + 1, previous[j] + 1, previous[j - 1] + (a != b)))
    return row[-1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--backend', choices=['doctr', 'cgan_doctr'], default='doctr')
    args = parser.parse_args()
    settings.ocr_backend = args.backend
    if args.manifest:
        records = json.loads(args.manifest.read_text(encoding='utf-8'))
        cases = [(Image.open(record['image']).convert('RGB'), record['reference']) for record in records]
    else:
        reference = 'PNR: 2626554557\nJourney date: 08/10/2026\nTrain: Aurora Express'
        image = Image.new('RGB', (1600, 600), 'white')
        fonts = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
        font = next((path for path in fonts if Path(path).exists()), None)
        if not font:
            raise RuntimeError('Supply a manifest or install a reference font')
        ImageDraw.Draw(image).multiline_text((60, 60), reference,
            font=ImageFont.truetype(font, 48), fill='black', spacing=20)
        cases = [(image, reference)]
    char_errors = word_errors = chars = words = 0
    details = []
    for index, (image, reference) in enumerate(cases):
        start = time.monotonic()
        result = structured_ocr.read(image)
        expected, actual = ' '.join(reference.split()), ' '.join(result['text'].split())
        ce, we = distance(expected, actual), distance(expected.split(), actual.split())
        char_errors += ce
        word_errors += we
        chars += len(expected)
        words += len(expected.split())
        details.append({'case': index, 'backend': result['backend'],
            'enhancementApplied': result['enhancementApplied'],
            'confidence': result['confidence'], 'seconds': round(time.monotonic() - start, 2),
            'cer': ce / max(1, len(expected)), 'wer': we / max(1, len(expected.split())),
            'warnings': result['warnings']})
    print(json.dumps({'cases': details, 'cer': char_errors / max(1, chars),
                     'wer': word_errors / max(1, words)}, indent=2))


if __name__ == '__main__':
    main()
