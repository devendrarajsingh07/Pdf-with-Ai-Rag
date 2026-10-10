import type { DocumentAnalysis as Analysis } from '@/types';
import styles from '@/components/workspace/workspace.module.css';

function MarkedText({ text, terms }: { text: string; terms: string[] }) {
  const escaped = Array.from(new Set(terms)).filter(Boolean).sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return <>{text}</>;
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  const matches = new Set(terms.map(term => term.toLowerCase()));
  return <>{text.split(pattern).map((part, index) => matches.has(part.toLowerCase())
    ? <mark key={index}>{part}</mark>
    : part)}</>;
}

export default function DocumentAnalysis({ analysis }: { analysis: Analysis }) {
  const highlights = [...analysis.importantTerms, ...analysis.dates.map(date => date.text),
    ...analysis.identifiers.map(identifier => identifier.value)];
  return (
    <section aria-label="Document analysis" className={styles.analysis}>
      <div><h2>Upload summary &amp; OCR quality</h2>
        <p className={styles.analysisIntro}>Extractive summary of every page · {analysis.totalTokens.toLocaleString()} lexical tokens. Highlighted dates and terms are source-text matches.</p></div>
      {analysis.warning && <p className={styles.analysisNote}>{analysis.warning}</p>}
      {analysis.identifiers.length > 0 && <div className={styles.analysisHighlights}>{analysis.identifiers.map((item, index) =>
        <span key={index}>{item.kind}: <mark>{item.value}</mark> · Page {item.pageNumber}</span>)}</div>}
      <div className={styles.summaries}>{analysis.summary.map(page => <div key={page.pageNumber}>
        <h3 className="text-sm font-medium">Page {page.pageNumber}</h3>
        <p className="text-sm whitespace-pre-wrap break-words"><MarkedText text={page.text || 'No readable text found.'} terms={highlights} /></p>
      </div>)}</div>
      {analysis.dates.length > 0 && <div className={styles.analysisHighlights} aria-label="Detected dates">{analysis.dates.map((date, index) =>
        <span key={index}><mark>{date.text}</mark> · Page {date.pageNumber}</span>)}</div>}
      <details className={styles.metrics}><summary>Per-page extraction metrics</summary>
        <div className={styles.tableScroll}><table><thead><tr>
          <th className="p-2">Page</th><th className="p-2">Method</th><th className="p-2">OCR confidence</th><th className="p-2">Low-confidence words</th><th className="p-2">Characters</th>
        </tr></thead><tbody>{analysis.pages.map(page => <tr key={page.pageNumber} className="border-t">
          <td className="p-2">{page.pageNumber}</td><td className="p-2">{page.method}</td>
          <td className="p-2">{page.ocrConfidence == null ? (page.ocrAttempted ? 'Unavailable' : 'Not needed') : `${page.ocrConfidence.toFixed(1)} / 100`}</td>
          <td className="p-2">{page.lowConfidenceWords} / {page.ocrWords}</td><td className="p-2">{page.extractedCharacters}</td>
        </tr>)}</tbody></table></div>
        {analysis.pages.flatMap(page => page.warnings.map((warning, index) =>
          <p className="text-sm text-amber-800" key={`${page.pageNumber}-${index}`}>Page {page.pageNumber}: {warning}</p>))}
      </details>
    </section>
  );
}
