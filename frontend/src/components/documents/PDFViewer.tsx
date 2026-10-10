"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "@/components/workspace/workspace.module.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
const PDF_OPTIONS = { withCredentials: true, isEvalSupported: false };

export default function PDFViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [pageWidth, setPageWidth] = useState(600);
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const element = canvas.current;
    const resize = () => setPageWidth(Math.max(200, Math.min(800, element.clientWidth - 44)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setNumPages(undefined); setPageNumber(1); setScale(1); }, [url]);
  const zoom = (delta: number) => setScale(s => Math.max(.5, Math.min(3, Math.round((s + delta) * 10) / 10)));
  return <section className={styles.viewer} aria-label="PDF viewer">
    <div className={styles.viewerToolbar}>
      <div className={styles.viewerControls}>
        <Button variant="ghost" size="icon" aria-label="Previous page" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}><ChevronLeft aria-hidden="true" /></Button>
        <span aria-live="polite">Page {numPages ? pageNumber : "—"} of {numPages || "—"}</span>
        <Button variant="ghost" size="icon" aria-label="Next page" onClick={() => setPageNumber(p => Math.min(numPages || 1, p + 1))} disabled={!numPages || pageNumber >= numPages}><ChevronRight aria-hidden="true" /></Button>
      </div>
      <div className={styles.viewerControls}>
        <Button variant="outline" size="icon" aria-label="Zoom out" onClick={() => zoom(-.2)} disabled={scale <= .5}><ZoomOut aria-hidden="true" /></Button>
        <span className="w-12 text-center" aria-live="polite">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="icon" aria-label="Zoom in" onClick={() => zoom(.2)} disabled={scale >= 3}><ZoomIn aria-hidden="true" /></Button>
      </div>
    </div>
    <div ref={canvas} className={styles.viewerCanvas}>
      <Document file={url} options={PDF_OPTIONS} onLoadSuccess={({ numPages: count }) => { setNumPages(count); setPageNumber(1); }}
        loading={<Skeleton className="h-[600px] w-full min-w-48" />}
        error={<p role="alert" className="p-6 text-destructive">Failed to load PDF file. Please refresh or try again later.</p>}
        className={styles.pdfDocument}>
        <Page pageNumber={pageNumber} width={pageWidth} scale={scale} loading={<Skeleton className="h-[600px] w-full min-w-48" />} renderAnnotationLayer={false} renderTextLayer />
      </Document>
    </div>
  </section>;
}
