import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { success } from '../../utils/response';
import { signGuestToken } from './mianjing.auth';
import {
  createOccurrenceSchema,
  createQuestionSchema,
  idSchema,
  listQuerySchema,
  saveCatalogSchema,
  updateMetaSchema,
  updateOccurrenceSchema,
  updateQuestionSchema,
} from './mianjing.schema';
import * as service from './mianjing.service';

export function guest(_req: Request, res: Response) {
  res.json(success({ token: signGuestToken(), expiresIn: 3600 }));
}

export async function me(req: Request, res: Response) {
  if (res.locals.mianjingRole === 'guest') {
    res.json(success({ role: 'guest', user: null, isAdmin: false, canEdit: false }));
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.userId },
    select: { id: true, email: true, username: true },
  });
  res.json(success({ role: 'admin', user, isAdmin: true, canEdit: true }));
}

export async function listQuestions(req: Request, res: Response) {
  res.json(success(await service.listQuestions(listQuerySchema.parse(req.query))));
}

export async function getQuestion(req: Request, res: Response) {
  res.json(success(await service.getQuestion(idSchema.parse(req.params.id))));
}

export async function getCatalog(_req: Request, res: Response) {
  res.json(success(await service.getCatalog()));
}

export async function saveCatalog(req: Request, res: Response) {
  res.json(success(await service.saveCatalog(saveCatalogSchema.parse(req.body))));
}

export async function createQuestion(req: Request, res: Response) {
  res.status(201).json(success(await service.createQuestion(createQuestionSchema.parse(req.body))));
}

export async function updateQuestion(req: Request, res: Response) {
  res.json(
    success(
      await service.updateQuestion(
        idSchema.parse(req.params.id),
        updateQuestionSchema.parse(req.body),
      ),
    ),
  );
}

export async function updateMeta(req: Request, res: Response) {
  res.json(
    success(
      await service.updateMeta(idSchema.parse(req.params.id), updateMetaSchema.parse(req.body)),
    ),
  );
}

export async function createOccurrence(req: Request, res: Response) {
  res
    .status(201)
    .json(
      success(
        await service.createOccurrence(
          idSchema.parse(req.params.id),
          createOccurrenceSchema.parse(req.body),
        ),
      ),
    );
}

export async function updateOccurrence(req: Request, res: Response) {
  const input = updateOccurrenceSchema.parse(req.body);
  res.json(success(await service.updateOccurrence(idSchema.parse(req.params.id), input.content)));
}

export async function deleteQuestion(req: Request, res: Response) {
  res.json(success(await service.deleteQuestion(idSchema.parse(req.params.id))));
}

export async function deleteOccurrence(req: Request, res: Response) {
  res.json(success(await service.deleteOccurrence(idSchema.parse(req.params.id))));
}
