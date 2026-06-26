import { Router, type IRouter } from 'express';
import * as weeklyReportController from './weekly-report.controller';

const router: IRouter = Router();

router.get('/', weeklyReportController.list);
router.get('/:weekKey', weeklyReportController.getByWeekKey);
router.put('/:weekKey', weeklyReportController.upsert);
router.delete('/:weekKey', weeklyReportController.remove);

export default router;
