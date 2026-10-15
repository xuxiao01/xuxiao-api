import { describe, expect, it } from 'vitest';
import { poiSuggestionsQuerySchema } from './map.schema';

describe('poiSuggestionsQuerySchema', () => {
  it('去除关键词空白并接受六个城市', () => {
    for (const cityCode of ['beijing', 'tianjin', 'harbin', 'yinchuan', 'zhongwei', 'wuzhong']) {
      expect(poiSuggestionsQuerySchema.parse({
        cityCode,
        keyword: '  海底捞  ',
      })).toEqual({ cityCode, keyword: '海底捞' });
    }
  });

  it('拒绝非法城市和关键词边界', () => {
    expect(poiSuggestionsQuerySchema.safeParse({
      cityCode: 'shanghai',
      keyword: '海底捞',
    }).success).toBe(false);
    expect(poiSuggestionsQuerySchema.safeParse({
      cityCode: 'beijing',
      keyword: '海',
    }).success).toBe(false);
    expect(poiSuggestionsQuerySchema.safeParse({
      cityCode: 'beijing',
      keyword: '海'.repeat(51),
    }).success).toBe(false);
  });
});
