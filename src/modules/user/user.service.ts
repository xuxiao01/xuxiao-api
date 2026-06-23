import type { User } from '../../generated/client';
import { prisma } from '../../lib/prisma';
import type { PublicUser } from './user.types';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
  };
}

export async function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(data: {
  email: string;
  username: string;
  passwordHash: string;
}) {
  return prisma.user.create({ data });
}
