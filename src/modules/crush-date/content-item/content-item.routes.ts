import { Router, type IRouter } from 'express';
import { imageUploadMiddleware } from '../upload/upload.middleware';
import * as contentItemController from './content-item.controller';

const router: IRouter = Router();

router.post('/', imageUploadMiddleware, contentItemController.create);
router.delete('/:id', contentItemController.remove);
router.patch('/:id/visited', contentItemController.updateVisited);

export default router;
