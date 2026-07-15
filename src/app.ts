import cors from 'cors';
import express, { type Express } from 'express';
import { errorMiddleware } from './middleware/error.middleware';
import { registerModules } from './modules';

const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'xuxiao-api is running',
  });
});

registerModules(app);

app.use(errorMiddleware);

export default app;
