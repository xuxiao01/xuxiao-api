import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as authController from './auth.controller';

const router: IRouter = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.me);

export default router;
