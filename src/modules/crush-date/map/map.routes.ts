import { Router, type IRouter } from 'express';
import { rateLimit } from 'express-rate-limit';
import { fail } from '../../../utils/response';
import { crushDateConfig } from '../crush-date.config';
import * as mapController from './map.controller';

const router: IRouter = Router();

const poiSearchRateLimit = rateLimit({
  windowMs: crushDateConfig.TENCENT_MAP_RATE_LIMIT_WINDOW_MS,
  limit: crushDateConfig.TENCENT_MAP_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json(fail('POI 搜索请求过于频繁')),
});

router.get(
  '/poi-suggestions',
  poiSearchRateLimit,
  mapController.listPoiSuggestions,
);

export default router;
