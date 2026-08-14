import { Router, type IRouter } from 'express';
import * as contentItemController from './content-item.controller';

const router: IRouter = Router();

router.get('/foods', contentItemController.listFoods);
router.get('/foods/:id', contentItemController.getFood);
router.get('/places', contentItemController.listPlaces);
router.get('/places/:id', contentItemController.getPlace);
router.get('/cities', contentItemController.listCities);
router.get('/food-categories', contentItemController.listFoodCategories);
router.get('/place-categories', contentItemController.listPlaceCategories);

export default router;
