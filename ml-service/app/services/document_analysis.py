"""Local extractive summaries and regex tokenization; source text is data only."""
import re
from collections import Counter

TOKEN = re.compile(r"\b[\w]+(?:[-/.:][\w]+)*\b", re.UNICODE)
DATE = re.compile(r'\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|'
                  r'\d{1,2}[-\s]+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|'
                  r'Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[-\s]+\d{4})\b', re.I)
PNR = re.compile(r'\bP\s*\.?\s*N\s*\.?\s*R\b(?:\s*(?:number|no\.?))?\s*[:#-]?\s*(\d(?:[ \t-]?\d){9})\b', re.I)
STOP = set('the and for with that this from are was were has have will your you not into can of to in on at a an is it be as by or'.split())


def analyze_document(pages: list[dict]) -> dict:
    counts = Counter(token.lower() for page in pages for token in TOKEN.findall(page['text'])
                     if len(token) > 2 and token.lower() not in STOP and not token.isdigit())
    summaries, dates, identifiers = [], [], []
    for page in pages:
        text = page['text']
        passages = [part.strip() for part in re.split(r'\n+|(?<=[.!?])\s+', text) if part.strip()]
        ranked = sorted(enumerate(passages), key=lambda pair: sum(
            counts[token.lower()] for token in TOKEN.findall(pair[1]) if token.lower() not in STOP
        ) + (20 if DATE.search(pair[1]) or 'pnr' in pair[1].lower() else 0), reverse=True)
        summary = ' '.join(passages[index] for index in sorted(index for index, _ in ranked[:3]))
        summaries.append({'pageNumber': page['page_number'], 'text': summary[:900]})
        dates.extend({'text': match.group(), 'pageNumber': page['page_number'],
                      'start': match.start(), 'end': match.end()} for match in DATE.finditer(text))
        identifiers.extend({'kind': 'PNR', 'value': re.sub(r'\D', '', match.group(1)),
                            'pageNumber': page['page_number']} for match in PNR.finditer(text))
    return {'version': 1, 'summaryMethod': 'extractive-per-page', 'summary': summaries,
            'importantTerms': [term for term, _ in counts.most_common(20)], 'dates': dates,
            'identifiers': identifiers,
            'totalTokens': sum(len(TOKEN.findall(page['text'])) for page in pages),
            'pages': [{'pageNumber': page['page_number'], 'method': page['extraction_method'],
                       **page['metrics']} for page in pages],
            'structuredPages': [{'pageNumber': page['page_number'], 'layout': page['structure'],
                                 'originalReading': page.get('originalReading')}
                                for page in pages if page.get('structure')],
            'warning': 'OCR confidence is not measured accuracy. Dates are text matches, not validated calendar values. Verify identifiers against the original PDF.'}


def expand_query(question: str) -> str:
    if re.search(r'\bpnr\b', question, re.I):
        return question + ' Passenger Name Record PNR number railway ticket booking reference journey date train reservation'
    return question
