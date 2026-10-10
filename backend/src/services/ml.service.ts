import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

const client = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 120000, // 2 min — PDF processing can be slow
  headers: {
    Authorization: `Bearer ${env.ML_SERVICE_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.error('ML Service Error', { error: error.message, data: error.response?.data });
    if (error.response?.data?.detail?.code === 'GENERATION_UNAVAILABLE') {
      throw new AppError('Answer generation is temporarily unavailable. Please try again shortly.', 503, 'GENERATION_UNAVAILABLE');
    }
    if (error.code === 'ECONNABORTED') {
      throw new AppError('ML service request timed out', 504, 'ML_SERVICE_TIMEOUT');
    }
    throw new AppError(
      'Error communicating with ML service',
      error.response?.status || 503,
      'ML_SERVICE_ERROR'
    );
  }
);

export class MLService {
  private static async recoverProcessingTimeout(documentId: string, userId: string, error: unknown, requestId: string) {
    if (!(error instanceof AppError) || error.code !== 'ML_SERVICE_TIMEOUT') {
      throw error;
    }

    const response = await client.get(`/api/v1/ml/documents/${documentId}/completion`, {
      params: { user_id: userId, request_id: requestId }, timeout: 30000,
    });
    if (response.data.completed && response.data.result) return response.data.result;
    // Existing/partial vectors cannot prove completion of this exact request.
    throw error;
  }

  /**
   * Tell the ML service to extract, chunk, embed and index a PDF.
   * FastAPI expects: { document_id, user_id, file_path }
   * file_path is the absolute server-side path that FastAPI can read directly
   * (both services share the uploads volume in Docker).
   */
  static async processDocument(documentId: string, userId: string, filePath: string, documentName?: string, requestId?: string) {
    const operationId = requestId || randomUUID();
    try {
      const response = await client.post('/api/v1/ml/documents/process', {
        document_id: documentId,
        user_id: userId,
        file_path: filePath,
        document_name: documentName,
      }, { timeout: 600000, headers: { 'X-User-Id': userId, 'X-Request-Id': operationId } });
      return response.data;
    } catch (error) {
      return this.recoverProcessingTimeout(documentId, userId, error, operationId);
    }
  }

  static async reindexDocument(documentId: string, userId: string, filePath: string, documentName?: string) {
    const operationId = randomUUID();
    try {
      const response = await client.post('/api/v1/ml/documents/reindex', {
        document_id: documentId,
        user_id: userId,
        file_path: filePath,
        document_name: documentName,
      }, { timeout: 600000, headers: { 'X-User-Id': userId, 'X-Request-Id': operationId } });
      return response.data;
    } catch (error) {
      return this.recoverProcessingTimeout(documentId, userId, error, operationId);
    }
  }

  static async deleteDocument(documentId: string, userId: string) {
    const response = await client.delete(`/api/v1/ml/documents/${documentId}`, {
      params: { user_id: userId },
    });
    return response.data;
  }

  static async getDocumentIndexStatus(documentId: string, userId: string) {
    const response = await client.get(`/api/v1/ml/documents/${documentId}/chunks`, {
      params: { user_id: userId },
      timeout: 30000,
    });
    return response.data as { document_id: string; chunks: number };
  }

  static async chat(
    userId: string,
    conversationId: string,
    question: string,
    documentIds: string[],
    conversationHistory: Array<{ role: string; content: string }> = [],
    requestId?: string
  ) {
    const response = await client.post('/api/v1/ml/chat', {
      user_id: userId,
      conversation_id: conversationId,
      question,
      document_ids: documentIds,
      conversation_history: conversationHistory,
    }, { headers: { 'X-User-Id': userId, 'X-Request-Id': requestId || randomUUID() } });
    return response.data;
  }

  static async retrieve(userId: string, query: string, documentIds: string[], topK = 5) {
    const response = await client.post('/api/v1/ml/retrieve', {
      user_id: userId,
      query,
      document_ids: documentIds,
      top_k: topK,
    }, { headers: { 'X-User-Id': userId, 'X-Request-Id': randomUUID() } });
    return response.data;
  }

  static async healthCheck() {
    const response = await client.get('/api/v1/ml/health');
    return response.data;
  }
}
