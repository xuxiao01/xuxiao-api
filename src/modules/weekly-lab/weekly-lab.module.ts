import type { Express } from 'express';
import type { ApiModule } from '../module';
import authRoutes from './auth/auth.routes';
import { authMiddleware } from './auth/auth.middleware';
import weeklyReportPublicRoutes from './weekly-report/weekly-report.public.routes';
import weeklyReportRoutes from './weekly-report/weekly-report.routes';

export const weeklyLabModule: ApiModule = {
  register(app: Express) {
    app.use('/api/auth', authRoutes);
    app.use('/api/weekly-reports', authMiddleware, weeklyReportRoutes);
    app.use('/api/public', weeklyReportPublicRoutes);
  },
};
