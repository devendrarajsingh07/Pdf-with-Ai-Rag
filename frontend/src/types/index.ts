export interface User { 
  id: string; 
  email: string; 
  name: string; 
  createdAt: string; 
}

export interface Document {
  id: string; 
  name: string; 
  originalName: string; 
  fileSize: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  pageCount?: number; 
  createdAt: string; 
  errorMessage?: string;
  analysis?: DocumentAnalysis | null;
}

export interface DocumentAnalysis {
  summaryMethod: string;
  summary: { pageNumber: number; text: string }[];
  importantTerms: string[];
  dates: { text: string; pageNumber: number; start: number; end: number }[];
  identifiers: { kind: string; value: string; pageNumber: number }[];
  totalTokens: number;
  warning: string;
  structuredPages?: { pageNumber: number; layout: OCRPageLayout;
    originalReading?: { text: string; structure: OCRPageLayout } | null }[];
  pages: { pageNumber: number; method: string; ocrAttempted: boolean;
    ocrConfidence: number | null; ocrWords: number; lowConfidenceWords: number;
    extractedCharacters: number; warnings: string[];
    ocrBackend?: 'tesseract' | 'doctr' | 'cgan_doctr' | null;
    enhancementApplied?: boolean; checkpointSha256?: string | null }[];
}

// docTR coordinates are normalized to the unrotated page raster, not PDF points.
export interface OCRPageLayout {
  dimensions: [number, number];
  blocks: { lines: { words: { value: string; confidence: number;
    geometry: [[number, number], [number, number]] }[] }[] }[];
}

export interface ChatSession {
  id: string; 
  title: string; 
  documentIds: string[]; 
  createdAt: string; 
  updatedAt: string;
}

export interface Citation {
  documentId: string; 
  documentName: string; 
  pageNumber: number;
  chunkId: string; 
  excerpt: string; 
  relevanceScore?: number;
}

export interface Message {
  id: string; 
  sessionId: string; 
  role: 'user' | 'assistant';
  content: string; 
  citations?: Citation[]; 
  createdAt: string;
}
