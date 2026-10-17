/**
 * 의류 마스터 데이터
 * 명세서「의류 아이템 마스터 목록」과 1:1 대응한다.
 * 이미지 파일명은 id와 동일하다. (assets/clothing/<id>.png)
 */

export type Category = 'top' | 'bottom' | 'outer' | 'shoes' | 'accessory';

/** 1 캐주얼 · 2 중립 · 3 오피스 */
export type Formality = 1 | 2 | 3;

export type AccessoryTrigger = 'rain' | 'snow' | 'wind' | 'uv' | 'cold' | 'air';

/** 누가 입는 옷인지. 대부분은 unisex이고, 꼭 필요한 것만 갈라놓는다. */
export type Gender = 'unisex' | 'female' | 'male';

type Base = {
  id: string;
  nameKo: string;
  /** 보온 기여도 0~5 */
  warmth: number;
  formality: Formality;
  /** 생략하면 unisex */
  gender?: Gender;
};

export type Top = Base & {
  category: 'top';
  sleeve: 'none' | 'short' | 'long';
  breathable: boolean;
  /** 위에 다른 상의를 겹쳐 입을 수 있는지 */
  layerable: boolean;
  /** 원피스처럼 상하의 일체형이면 true — 하의를 따로 추천하지 않는다 */
  fullBody?: boolean;
};

export type Bottom = Base & {
  category: 'bottom';
  length: 'short' | 'long';
};

export type Outer = Base & {
  category: 'outer';
  windproof: boolean;
  waterproof: boolean;
  /** 1~3, 클수록 벗기 편함 */
  removability: 1 | 2 | 3;
};

export type Shoes = Base & {
  category: 'shoes';
  waterproof: boolean;
  antiSlip: boolean;
  breathable: boolean;
};

export type Accessory = Base & {
  category: 'accessory';
  trigger: AccessoryTrigger[];
};

export type Item = Top | Bottom | Outer | Shoes | Accessory;

/* ------------------------------------------------------------------- 상의 */

export const TOPS: Top[] = [
  // 여성 전용
  { id: 'blouse', nameKo: '블라우스', category: 'top', warmth: 1, sleeve: 'long', breathable: true, layerable: true, formality: 3, gender: 'female' },
  { id: 'onepiece', nameKo: '원피스', category: 'top', warmth: 1, sleeve: 'short', breathable: true, layerable: false, fullBody: true, formality: 2, gender: 'female' },
  { id: 'knit_onepiece', nameKo: '니트 원피스', category: 'top', warmth: 3, sleeve: 'long', breathable: false, layerable: false, fullBody: true, formality: 2, gender: 'female' },
  { id: 'sleeveless', nameKo: '나시', category: 'top', warmth: 0, sleeve: 'none', breathable: true, layerable: true, formality: 1 },
  { id: 'short_tee', nameKo: '반팔 티셔츠', category: 'top', warmth: 0, sleeve: 'short', breathable: true, layerable: true, formality: 1 },
  { id: 'thin_shirt', nameKo: '얇은 셔츠', category: 'top', warmth: 1, sleeve: 'long', breathable: true, layerable: true, formality: 3 },
  { id: 'long_tee', nameKo: '긴팔 티셔츠', category: 'top', warmth: 1, sleeve: 'long', breathable: false, layerable: true, formality: 1 },
  { id: 'thin_knit', nameKo: '얇은 니트', category: 'top', warmth: 2, sleeve: 'long', breathable: false, layerable: true, formality: 2 },
  { id: 'sweatshirt', nameKo: '맨투맨', category: 'top', warmth: 2, sleeve: 'long', breathable: false, layerable: false, formality: 1 },
  { id: 'hoodie', nameKo: '후드티', category: 'top', warmth: 3, sleeve: 'long', breathable: false, layerable: false, formality: 1 },
  { id: 'knit', nameKo: '니트', category: 'top', warmth: 3, sleeve: 'long', breathable: false, layerable: false, formality: 2 },
];

/* ------------------------------------------------------------------- 하의 */

export const BOTTOMS: Bottom[] = [
  // 여성 전용 — 치마는 보온이 바지보다 낮고 레깅스와 겹쳐 입는 경우가 많다
  { id: 'skirt', nameKo: '스커트', category: 'bottom', warmth: 0, length: 'short', formality: 2, gender: 'female' },
  { id: 'long_skirt', nameKo: '롱스커트', category: 'bottom', warmth: 1, length: 'long', formality: 2, gender: 'female' },
  { id: 'leggings', nameKo: '레깅스', category: 'bottom', warmth: 2, length: 'long', formality: 1, gender: 'female' },
  { id: 'wide_pants', nameKo: '와이드 팬츠', category: 'bottom', warmth: 2, length: 'long', formality: 2, gender: 'female' },
  { id: 'shorts', nameKo: '반바지', category: 'bottom', warmth: 0, length: 'short', formality: 1 },
  { id: 'jeans', nameKo: '청바지', category: 'bottom', warmth: 2, length: 'long', formality: 1 },
  { id: 'long_pants', nameKo: '긴바지', category: 'bottom', warmth: 2, length: 'long', formality: 3 },
  { id: 'sweatpants', nameKo: '추리닝 바지', category: 'bottom', warmth: 2, length: 'long', formality: 1 },
  { id: 'corduroy_pants', nameKo: '코듀로이 바지', category: 'bottom', warmth: 3, length: 'long', formality: 2 },
];

/* ----------------------------------------------------------------- 아우터 */

export const OUTERS: Outer[] = [
  { id: 'cardigan', nameKo: '가디건', category: 'outer', warmth: 1, windproof: false, waterproof: false, removability: 3, formality: 2 },
  { id: 'light_jacket', nameKo: '가벼운 재킷', category: 'outer', warmth: 2, windproof: true, waterproof: false, removability: 3, formality: 2 },
  { id: 'rain_jacket', nameKo: '방수 재킷', category: 'outer', warmth: 2, windproof: true, waterproof: true, removability: 3, formality: 1 },
  { id: 'trench_coat', nameKo: '트렌치코트', category: 'outer', warmth: 2, windproof: true, waterproof: true, removability: 2, formality: 3 },
  { id: 'light_padding', nameKo: '경량 패딩', category: 'outer', warmth: 3, windproof: true, waterproof: false, removability: 3, formality: 1 },
  { id: 'coat', nameKo: '코트', category: 'outer', warmth: 3, windproof: false, waterproof: false, removability: 2, formality: 3 },
  { id: 'padding', nameKo: '패딩', category: 'outer', warmth: 4, windproof: true, waterproof: false, removability: 2, formality: 1 },
  { id: 'heavy_padding', nameKo: '방한 패딩', category: 'outer', warmth: 5, windproof: true, waterproof: false, removability: 1, formality: 1 },
];

/* ------------------------------------------------------------------- 신발 */

export const SHOES: Shoes[] = [
  // 여성 전용
  { id: 'flats', nameKo: '플랫슈즈', category: 'shoes', warmth: 1, waterproof: false, antiSlip: false, breathable: false, formality: 2, gender: 'female' },
  { id: 'sandals', nameKo: '샌들', category: 'shoes', warmth: 0, waterproof: true, antiSlip: false, breathable: true, formality: 2, gender: 'female' },
  { id: 'flip_flops', nameKo: '쪼리', category: 'shoes', warmth: 0, waterproof: true, antiSlip: false, breathable: true, formality: 1 },
  { id: 'sneakers', nameKo: '운동화', category: 'shoes', warmth: 1, waterproof: false, antiSlip: false, breathable: true, formality: 1 },
  { id: 'dress_shoes', nameKo: '구두', category: 'shoes', warmth: 1, waterproof: false, antiSlip: false, breathable: false, formality: 3 },
  { id: 'boots', nameKo: '부츠', category: 'shoes', warmth: 3, waterproof: true, antiSlip: true, breathable: false, formality: 2 },
];

/* ----------------------------------------------------------------- 준비물 */

export const ACCESSORIES: Accessory[] = [
  { id: 'umbrella', nameKo: '우산', category: 'accessory', warmth: 0, trigger: ['rain'], formality: 2 },
  { id: 'sunscreen', nameKo: '선크림', category: 'accessory', warmth: 0, trigger: ['uv'], formality: 2 },
  { id: 'cap', nameKo: '모자', category: 'accessory', warmth: 0, trigger: ['uv'], formality: 1 },
  { id: 'sunglasses', nameKo: '선글라스', category: 'accessory', warmth: 0, trigger: ['uv'], formality: 2 },
  { id: 'scarf', nameKo: '목도리', category: 'accessory', warmth: 0, trigger: ['cold'], formality: 2 },
  { id: 'gloves', nameKo: '장갑', category: 'accessory', warmth: 0, trigger: ['cold'], formality: 2 },
  { id: 'beanie', nameKo: '비니', category: 'accessory', warmth: 0, trigger: ['cold'], formality: 1 },
  { id: 'mask', nameKo: '마스크', category: 'accessory', warmth: 0, trigger: ['air', 'cold'], formality: 2 },
];

export const ALL_ITEMS: Item[] = [
  ...TOPS, ...BOTTOMS, ...OUTERS, ...SHOES, ...ACCESSORIES,
];

const BY_ID = new Map<string, Item>(ALL_ITEMS.map((i) => [i.id, i]));

/**
 * 성별에 맞는 아이템인지.
 * unisex는 누구에게나, 나머지는 같은 성별에게만 추천한다.
 */
export function fitsGender(item: { gender?: Gender }, gender: 'female' | 'male'): boolean {
  const g = item.gender ?? 'unisex';
  return g === 'unisex' || g === gender;
}

export function item(id: string): Item {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 의류 id: ${id}`);
  return found;
}

export function nameOf(id: string): string {
  return BY_ID.get(id)?.nameKo ?? id;
}

/** 의류 id 배열 → "얇은 니트 + 가벼운 재킷 + 긴바지" */
export function describeOutfit(ids: string[]): string {
  return ids.map(nameOf).join(' + ');
}
