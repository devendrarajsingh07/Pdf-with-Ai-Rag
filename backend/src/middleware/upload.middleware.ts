import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new AppError('Only PDF files are allowed', 400, 'INVALID_FILE_TYPE') as any, false);
  }
};

export const uploadPDF = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 1,
    fields: 5,
    parts: 6,
  },
});

export const validatePdfSignature = async (req: any, _res: any, next: any) => {
  if (!req.file) return next();

  try {
    const handle = await fs.promises.open(req.file.path, 'r');
    const signature = Buffer.alloc(5);
    await handle.read(signature, 0, 5, 0);
    await handle.close();
    if (signature.toString('ascii') !== '%PDF-') {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      req.file = undefined;
      return next(new AppError('The uploaded file is not a valid PDF', 400, 'INVALID_PDF'));
    }
    next();
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    next(error);
  }
};
