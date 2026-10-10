import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadPDF, validatePdfSignature } from '../middleware/upload.middleware';
import { requireJobKey } from '../middleware/idempotency.middleware';
import rateLimit from 'express-rate-limit';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
const uploadLimiter = rateLimit({ windowMs: 60000, max: 3,
  keyGenerator: req => (req as AuthRequest).user!.id,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'UPLOAD_RATE_LIMIT', message: 'Too many uploads; please wait before retrying.' } },
});

router.get('/', DocumentController.getUserDocuments);
router.post('/', uploadLimiter, requireJobKey, uploadPDF.single('file'), validatePdfSignature, DocumentController.uploadDocument);
router.post('/upload', uploadLimiter, requireJobKey, uploadPDF.single('file'), validatePdfSignature, DocumentController.uploadDocument); // alias
router.get('/:id/file', DocumentController.streamDocument);
router.get('/:id', DocumentController.getDocument);
router.delete('/:id', DocumentController.deleteDocument);
router.post('/:id/reindex', requireJobKey, DocumentController.reindexDocument);
router.get('/:id/status', DocumentController.getDocumentStatus);

export default router;
