import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../../../utils/app-error';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(new AppError(400, '仅支持 JPG、PNG 或 WebP 图片'));
      return;
    }
    callback(null, true);
  },
});

export function imageUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? '图片大小不能超过 5MB'
        : '图片上传参数错误';
      next(new AppError(400, message));
      return;
    }

    next(error);
  });
}
