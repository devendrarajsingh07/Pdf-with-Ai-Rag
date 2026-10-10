import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../utils/errors';
import { documentParamsSchema } from '../validators/document.validator';
import { toDocumentDto } from '../utils/document.dto';
import path from 'path';

export class DocumentController {
  static async uploadDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError('No file provided', 400);
      const doc = await DocumentService.createDocument(req.user!.id, req.file, req.get('Idempotency-Key'));
      res.status(201).json({ success: true, data: toDocumentDto(doc) });
    } catch (error) {
      next(error);
    }
  }

  static async getUserDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const docs = await DocumentService.getUserDocuments(req.user!.id);
      res.status(200).json({ success: true, data: docs.map(toDocumentDto) });
    } catch (error) {
      next(error);
    }
  }

  static async getDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = documentParamsSchema.parse(req).params;
      const doc = await DocumentService.getDocument(id, req.user!.id);
      res.status(200).json({ success: true, data: toDocumentDto(doc) });
    } catch (error) {
      next(error);
    }
  }

  static async streamDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = documentParamsSchema.parse(req).params;
      const doc = await DocumentService.getDocument(id, req.user!.id);
      res.type('application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
      res.sendFile(DocumentService.resolveFilePath(doc.filePath), (error) => {
        if (error && !res.headersSent) next(error);
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = documentParamsSchema.parse(req).params;
      await DocumentService.deleteDocument(id, req.user!.id);
      res.status(200).json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async reindexDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = documentParamsSchema.parse(req).params;
      const result = await DocumentService.reindexDocument(id, req.user!.id, req.get('Idempotency-Key'));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getDocumentStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = documentParamsSchema.parse(req).params;
      const doc = await DocumentService.getDocument(id, req.user!.id);
      res.status(200).json({
        success: true,
        data: {
          id: doc.id,
          status: doc.status,
          pageCount: doc.pageCount,
          errorMessage: doc.errorMessage,
          analysis: doc.analysis,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
