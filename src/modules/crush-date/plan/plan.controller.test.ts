import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  updateStatus: vi.fn(),
}));

vi.mock('./plan.service', () => ({
  updateStatus: mocks.updateStatus,
}));

import { updateStatus } from './plan.controller';

describe('updateStatus controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('激活成功返回 200 和更新后的 Plan', async () => {
    const plan = {
      id: 'plan-backup-1',
      status: 'active',
      date: '2099-07-26',
    };
    const request = {
      params: { id: plan.id },
      body: {
        status: plan.status,
        date: plan.date,
      },
    };
    const response = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    mocks.updateStatus.mockResolvedValue(plan);

    await updateStatus(request as never, response as never, next);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(plan);
    expect(next).not.toHaveBeenCalled();
  });
});
