import { AppError } from '../../utils/app-error';
import { signToken } from '../../utils/jwt';
import { comparePassword, hashPassword } from '../../utils/password';
import {
  createUser,
  findByEmail,
  findById,
  toPublicUser,
} from '../user/user.service';
import type { LoginInput, RegisterInput } from './auth.schema';

export async function register(input: RegisterInput) {
  const existing = await findByEmail(input.email);
  if (existing) {
    throw new AppError(409, '该邮箱已被注册');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    email: input.email,
    username: input.username,
    passwordHash,
  });

  const token = signToken({ userId: user.id, email: user.email });

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function login(input: LoginInput) {
  const user = await findByEmail(input.email);
  if (!user) {
    throw new AppError(401, '邮箱或密码错误');
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, '邮箱或密码错误');
  }

  const token = signToken({ userId: user.id, email: user.email });

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function getMe(userId: number) {
  const user = await findById(userId);
  if (!user) {
    throw new AppError(401, '用户不存在');
  }

  return toPublicUser(user);
}
