import { Router, type IRouter } from 'express';
import { imageUploadMiddleware } from '../upload/upload.middleware';
import * as planPhotoController from './plan-photo.controller';

const router: IRouter = Router();

router.post('/:planId/photos', imageUploadMiddleware, planPhotoController.create);
router.get('/:planId/photos', planPhotoController.list);
router.patch('/:planId/photos/order', planPhotoController.reorder);
router.delete('/:planId/photos/:photoId', planPhotoController.remove);

export default router;
