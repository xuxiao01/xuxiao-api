import type { Express } from 'express';
import type { ApiModule } from '../module';
import contentItemListRoutes from './content-item/content-item-list.routes';
import contentItemRoutes from './content-item/content-item.routes';
import planRoutes from './plan/plan.routes';
import uploadRoutes from './upload/upload.routes';

export const crushDateModule: ApiModule = {
  register(app: Express) {
    app.use('/api/crush-date', contentItemListRoutes);
    app.use('/api/crush-date/content-items', contentItemRoutes);
    app.use('/api/crush-date/plans', planRoutes);
    app.use('/api/crush-date/uploads/images', uploadRoutes);
  },
};
