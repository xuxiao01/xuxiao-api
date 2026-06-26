import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/app-error';
import { isValidWeekKey } from '../../utils/week-key';
import {
  toWeekListItem,
  toWeekResponse,
  weekInclude,
} from './weekly-report.mapper';
import type { PutWeeklyReportInput } from './weekly-report.types';

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function findOwnedWeek(userId: number, weekKey: string) {
  return prisma.weeklyReportWeek.findUnique({
    where: {
      userId_weekKey: {
        userId,
        weekKey,
      },
    },
    include: weekInclude,
  });
}

export async function existsForUser(userId: number, weekKey: string): Promise<boolean> {
  const week = await prisma.weeklyReportWeek.findUnique({
    where: {
      userId_weekKey: {
        userId,
        weekKey,
      },
    },
    select: { id: true },
  });
  return !!week;
}

export async function listByUser(userId: number) {
  const weeks = await prisma.weeklyReportWeek.findMany({
    where: { userId },
    include: weekInclude,
    orderBy: { startDate: 'desc' },
  });

  return weeks.map(toWeekListItem);
}

export async function getByWeekKey(userId: number, weekKey: string) {
  if (!isValidWeekKey(weekKey)) {
    throw new AppError(400, 'week_key 格式非法');
  }

  const week = await findOwnedWeek(userId, weekKey);
  if (!week) {
    throw new AppError(404, '周报不存在');
  }

  return toWeekResponse(week);
}

export async function upsert(userId: number, weekKey: string, input: PutWeeklyReportInput) {
  if (!isValidWeekKey(weekKey)) {
    throw new AppError(400, 'week_key 格式非法');
  }

  const existing = await findOwnedWeek(userId, weekKey);
  const reports = input.reports;

  let startDate: Date;
  let endDate: Date;

  if (!existing) {
    if (!input.startDate || !input.endDate) {
      throw new AppError(400, '新建周报时 startDate 和 endDate 必填');
    }
    startDate = parseDateOnly(input.startDate);
    endDate = parseDateOnly(input.endDate);
  } else {
    startDate = input.startDate ? parseDateOnly(input.startDate) : existing.startDate;
    endDate = input.endDate ? parseDateOnly(input.endDate) : existing.endDate;
  }

  if (startDate > endDate) {
    throw new AppError(400, 'startDate 不能晚于 endDate');
  }

  const isPublished = input.isPublished ?? existing?.isPublished ?? false;

  await prisma.$transaction(async (tx) => {
    const week = existing
      ? await tx.weeklyReportWeek.update({
          where: { id: existing.id },
          data: {
            startDate,
            endDate,
            isPublished,
          },
        })
      : await tx.weeklyReportWeek.create({
          data: {
            userId,
            weekKey,
            startDate,
            endDate,
            isPublished,
          },
        });

    await tx.weeklyReport.deleteMany({
      where: { weekId: week.id },
    });

    for (let reportIndex = 0; reportIndex < reports.length; reportIndex++) {
      const reportInput = reports[reportIndex];
      const report = await tx.weeklyReport.create({
        data: {
          weekId: week.id,
          sortOrder: reportIndex + 1,
          partLabel: reportInput.partLabel,
          title: reportInput.title,
        },
      });

      const items = [
        ...reportInput.completed.map((item, index) => ({
          section: 'completed',
          sortOrder: index + 1,
          title: item.title,
          description: item.description,
          images: item.images,
        })),
        ...reportInput.nextPlans.map((item, index) => ({
          section: 'next_plans',
          sortOrder: index + 1,
          title: item.title,
          description: item.description,
          images: item.images,
        })),
      ];

      if (items.length > 0) {
        await tx.weeklyReportItem.createMany({
          data: items.map((item) => ({
            reportId: report.id,
            section: item.section,
            sortOrder: item.sortOrder,
            title: item.title,
            description: item.description,
            images: item.images,
          })),
        });
      }
    }
  });

  return getByWeekKey(userId, weekKey);
}

export async function deleteByWeekKey(userId: number, weekKey: string) {
  if (!isValidWeekKey(weekKey)) {
    throw new AppError(400, 'week_key 格式非法');
  }

  const existing = await findOwnedWeek(userId, weekKey);
  if (!existing) {
    throw new AppError(404, '周报不存在');
  }

  await prisma.weeklyReportWeek.delete({
    where: { id: existing.id },
  });
}

export async function getPublicByUsernameAndWeekKey(username: string, weekKey: string) {
  if (!isValidWeekKey(weekKey)) {
    throw new AppError(404, '周报不存在');
  }

  const week = await prisma.weeklyReportWeek.findFirst({
    where: {
      weekKey,
      isPublished: true,
      user: {
        username,
        publicWeeklyReportsEnabled: true,
      },
    },
    include: weekInclude,
  });

  if (!week) {
    throw new AppError(404, '周报不存在');
  }

  return toWeekResponse(week);
}
