import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../utils/app-error';
import { uploadImageFieldsSchema } from './upload.schema';
import * as uploadService from './upload.service';

export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError(400, 'file 图片文件必填');
    }

    const fields = uploadImageFieldsSchema.parse(req.body);
    const result = await uploadService.uploadImage({
      contentType: fields.contentType,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
