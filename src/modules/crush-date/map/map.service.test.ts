import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestTencentPoiSuggestions: vi.fn(),
}));

vi.mock('./tencent-map.client', () => ({
  requestTencentPoiSuggestions: mocks.requestTencentPoiSuggestions,
}));
vi.mock('../crush-date.config', () => ({
  crushDateConfig: {
    TENCENT_MAP_CACHE_TTL_SECONDS: 600,
  },
}));

import {
  clearPoiSuggestionsCache,
  listPoiSuggestions,
} from './map.service';

beforeEach(() => {
  vi.clearAllMocks();
  clearPoiSuggestionsCache();
});

describe('listPoiSuggestions', () => {
  it('映射腾讯候选、过滤不完整数据并限制十条', async () => {
    const completeItem = (index: number) => ({
      id: `poi-${index}`,
      title: `海底捞 ${index} 店`,
      address: `北京市朝阳区 ${index} 号`,
      location: { lat: 39.9 + index / 1000, lng: 116.4 },
      adcode: 110105,
      city: '北京市',
      district: '朝阳区',
    });
    mocks.requestTencentPoiSuggestions.mockResolvedValue([
      ...Array.from({ length: 12 }, (_, index) => completeItem(index)),
      { id: 'incomplete', title: '缺少地址和坐标' },
    ]);

    const result = await listPoiSuggestions({
      cityCode: 'beijing',
      keyword: '海底捞',
    });

    expect(mocks.requestTencentPoiSuggestions).toHaveBeenCalledWith('北京市', '海底捞');
    expect(result.list).toHaveLength(10);
    expect(result.list[0]).toEqual({
      provider: 'tencent',
      poiId: 'poi-0',
      title: '海底捞 0 店',
      address: '北京市朝阳区 0 号',
      latitude: 39.9,
      longitude: 116.4,
      adcode: '110105',
      city: '北京市',
      district: '朝阳区',
    });
  });

  it.each([
    ['yinchuan', '银川市'],
    ['zhongwei', '中卫市'],
    ['wuzhong', '吴忠市'],
  ] as const)('%s 使用对应的腾讯地图搜索区域', async (cityCode, region) => {
    mocks.requestTencentPoiSuggestions.mockResolvedValue([]);

    await listPoiSuggestions({ cityCode, keyword: '公园' });

    expect(mocks.requestTencentPoiSuggestions).toHaveBeenCalledWith(region, '公园');
  });

  it('相同城市和标准化关键词命中缓存', async () => {
    mocks.requestTencentPoiSuggestions.mockResolvedValue([]);

    await listPoiSuggestions({ cityCode: 'tianjin', keyword: '天津眼' });
    await listPoiSuggestions({ cityCode: 'tianjin', keyword: ' 天津眼 ' });

    expect(mocks.requestTencentPoiSuggestions).toHaveBeenCalledTimes(1);
  });
});
