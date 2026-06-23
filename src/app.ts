import cors from 'cors';
import express, { type Express } from 'express';
import { errorMiddleware } from './middleware/error.middleware';
import authRoutes from './modules/auth/auth.routes';

const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'xuxiao-api is running',
  });
});

app.use('/api/auth', authRoutes);

app.use(errorMiddleware);

export default app;
