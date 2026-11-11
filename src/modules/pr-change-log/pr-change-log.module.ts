import { Router } from 'express';
import type { ApiModule } from '../module';
import * as controller from './pr-change-log.controller';
import { bodyError, requireIngest, requireViewer } from './pr-change-log.middleware';

export const prChangeLogModule: ApiModule = {
  register(app) {
    const router = Router();
    router.post('/ingest', requireIngest, controller.ingest);
    router.use(requireViewer);
    router.get('/me', controller.me);
    router.get('/records', controller.list);
    router.get('/records/:id', controller.detail);
    router.post('/records/:id/reanalyze', controller.reanalyze);
    app.use('/api/pr-change-log', router);
    app.use('/api/pr-change-log', bodyError);
  },
};
