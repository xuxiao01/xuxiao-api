import { Router, type IRouter } from 'express';
import * as weeklyReportController from './weekly-report.controller';

const router: IRouter = Router();

router.get(
  '/users/:username/weekly-reports/:weekKey',
  weeklyReportController.getPublic,
);

export default router;
