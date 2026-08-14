export const cities = [
  { code: 'beijing', name: '北京', enabled: true, sortOrder: 0 },
  { code: 'tianjin', name: '天津', enabled: true, sortOrder: 1 },
  { code: 'harbin', name: '哈尔滨', enabled: true, sortOrder: 2 },
] as const;

export const foodCategories = [
  { id: '1', name: '全部分类', sortOrder: 0, filterOnly: true },
  { id: '2', name: '中餐', sortOrder: 1, filterOnly: false },
  { id: '3', name: '火锅', sortOrder: 2, filterOnly: false },
  { id: '4', name: '烧烤烤肉', sortOrder: 3, filterOnly: false },
  { id: '5', name: '日韩及亚洲料理', sortOrder: 4, filterOnly: false },
  { id: '6', name: '西餐', sortOrder: 5, filterOnly: false },
  { id: '7', name: '小吃快餐', sortOrder: 6, filterOnly: false },
  { id: '8', name: '甜品饮品', sortOrder: 7, filterOnly: false },
  { id: '9', name: '其他', sortOrder: 8, filterOnly: false },
] as const;

export const placeCategories = [
  { id: '1', name: '全部分类', sortOrder: 0, filterOnly: true },
  { id: '2', name: '公园户外', sortOrder: 1, filterOnly: false },
  { id: '3', name: '景点打卡', sortOrder: 2, filterOnly: false },
  { id: '4', name: '展览演出', sortOrder: 3, filterOnly: false },
  { id: '5', name: '运动健身', sortOrder: 4, filterOnly: false },
  { id: '6', name: '休闲娱乐', sortOrder: 5, filterOnly: false },
  { id: '7', name: '其他', sortOrder: 6, filterOnly: false },
] as const;

export const cityCodes = cities.map((city) => city.code) as [
  CityCode,
  ...CityCode[],
];

export const foodCategoryFilterIds = foodCategories.map((category) => (
  category.id
)) as [FoodCategoryFilterId, ...FoodCategoryFilterId[]];

export const foodCategoryIds = foodCategoryFilterIds.slice(1) as [
  FoodCategoryId,
  ...FoodCategoryId[],
];

export const placeCategoryFilterIds = placeCategories.map((category) => (
  category.id
)) as [PlaceCategoryFilterId, ...PlaceCategoryFilterId[]];

export const placeCategoryIds = placeCategoryFilterIds.slice(1) as [
  PlaceCategoryId,
  ...PlaceCategoryId[],
];

export type CityCode = (typeof cities)[number]['code'];
export type FoodCategoryFilterId = (typeof foodCategories)[number]['id'];
export type FoodCategoryId = Exclude<FoodCategoryFilterId, '1'>;
export type PlaceCategoryFilterId = (typeof placeCategories)[number]['id'];
export type PlaceCategoryId = Exclude<PlaceCategoryFilterId, '1'>;

export const DEFAULT_CITY_CODE: CityCode = 'beijing';
export const DEFAULT_FOOD_CATEGORY_ID: FoodCategoryId = '9';
export const DEFAULT_PLACE_CATEGORY_ID: PlaceCategoryId = '7';
