import { Router, type IRouter } from 'express';
import * as contentItemController from './content-item.controller';

const router: IRouter = Router();

router.get('/foods', contentItemController.listFoods);
router.get('/places', contentItemController.listPlaces);

export default router;
