import type { ApiModule } from '../module';
import { health } from './mianjing.health';
import { guest } from './mianjing.controller';
import { mianjingBodyError, authenticateMianjing } from './mianjing.middleware';
import routes from './mianjing.routes';

export const mianjingModule: ApiModule = {
  register(app) {
    app.get('/api/mianjing/health', health);
    app.post('/api/mianjing/auth/guest', guest);
    app.use('/api/mianjing', authenticateMianjing, routes);
    app.use('/api/mianjing', mianjingBodyError);
  },
};
