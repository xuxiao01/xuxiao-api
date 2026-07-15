import { Router, type IRouter } from 'express';
import * as planController from './plan.controller';

const router: IRouter = Router();

router.get('/', planController.list);
router.post('/', planController.create);
router.get('/:id', planController.getById);
router.patch('/:id', planController.update);
router.delete('/:id', planController.remove);
router.post('/:id/activate', planController.activate);
router.post('/:id/complete', planController.complete);
router.post('/:id/replan', planController.replan);

export default router;
