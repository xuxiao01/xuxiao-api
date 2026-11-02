import { Router, type IRouter } from 'express';
import { requireAdmin } from './mianjing.middleware';
import * as controller from './mianjing.controller';

const router: IRouter = Router();
router.get('/me', controller.me);
router.get('/questions', controller.listQuestions);
router.get('/questions/:id', controller.getQuestion);
router.get('/company-catalog', controller.getCatalog);

router.use(requireAdmin);
router.post('/questions', controller.createQuestion);
router.patch('/questions/:id', controller.updateQuestion);
router.patch('/questions/:id/meta', controller.updateMeta);
router.post('/questions/:id/occurrences', controller.createOccurrence);
router.patch('/occurrences/:id', controller.updateOccurrence);
router.put('/company-catalog', controller.saveCatalog);
router.delete('/questions/:id', controller.deleteQuestion);
router.delete('/occurrences/:id', controller.deleteOccurrence);

export default router;
