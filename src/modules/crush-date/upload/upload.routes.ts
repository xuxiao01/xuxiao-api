import { Router, type IRouter } from 'express';
import * as uploadController from './upload.controller';
import { imageUploadMiddleware } from './upload.middleware';

const router: IRouter = Router();

router.post('/', imageUploadMiddleware, uploadController.uploadImage);

export default router;
