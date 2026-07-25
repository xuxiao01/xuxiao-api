import type { NextFunction, Request, Response } from 'express';
import {
  createPlanSchema,
  planParamsSchema,
  replanPlanSchema,
  updatePlanStatusSchema,
  updatePlanSchema,
} from './plan.schema';
import * as planService from './plan.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createPlanSchema.parse(req.body);
    const plan = await planService.create(input);
    return res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
}

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await planService.list();
    return res.json(plans);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = planParamsSchema.parse(req.params);
    const plan = await planService.getById(id);
    return res.json(plan);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = planParamsSchema.parse(req.params);
    const input = updatePlanSchema.parse(req.body);
    const plan = await planService.update(id, input);
    return res.json(plan);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = planParamsSchema.parse(req.params);
    await planService.remove(id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = planParamsSchema.parse(req.params);
    const input = updatePlanStatusSchema.parse(req.body);
    const plan = await planService.updateStatus(id, input);
    return res.json(plan);
  } catch (error) {
    next(error);
  }
}

export async function replan(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = planParamsSchema.parse(req.params);
    const input = replanPlanSchema.parse(req.body);
    const plan = await planService.replan(id, input);
    return res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
}
