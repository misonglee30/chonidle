/**
 * 추천 엔진 — 결정론적 규칙 기반.
 * 같은 입력이면 언제나 같은 결과를 낸다. 난수·다양성 로직 없음.
 * 명세서「체감 구간별 기본 조합」「환경 조건 규칙」과 1:1 대응한다.
 */

import type {
  Activity,
  EnvSensitivity,
  ProfileType,
  Style,
  UserSettings,
} from '@/lib/settings';
import {
  fitsGender,
  ACCESSORIES,
  BOTTOMS,
  OUTERS,
  SHOES,
  TOPS,
  type Bottom,
  type Outer,
  type Shoes,
  type Top,
} from '@/lib/clothing';

/* ---------------------------------------------------------------- 입출력 */

export type HourPoint = {
  /** ISO 8601, 로컬 타임존 */
  time: string;
  temp: number;
  /** 없으면 null — 기온으로 대체한다 */
  feelsLike: number | null;
  humidity: number;
  /** km/h */
  wind: number;
  windGust: number | null;
  /** % */
  precipProb: number;
  /** mm/h */
  precipAmount: number;
  uvIndex: number | null;
  weatherCode: number;
  isDay: boolean;
};

export type AirQuality = {
  /** µg/m³ */
  pm25: number | null;
  pm10: number | null;
};

export type {
  Activity,
  EnvSensitivity,
  ProfileType,
  Style,
  UserSettings,
} from '@/lib/settings';

export type ReasonCode =
  | 'SEVERE_COLD'
  | 'COOL_MORNING'
  | 'TEMPERATURE_DROP'
  | 'WIDE_RANGE'
  | 'HEAVY_RAIN'
  | 'RAIN_POSSIBLE'
  | 'SNOW'
  | 'STRONG_WIND'
  | 'WINDY'
  | 'DUST_VERY_HIGH'
  | 'DUST_HIGH'
  | 'HUMID'
  | 'UV_HIGH'
  | 'UV_MODERATE'
  | 'AC_INDOOR'
  | 'PROFILE_COLD'
  | 'PROFILE_HOT';

export type DataQuality = 'full' | 'partial' | 'stale';

export type Outfit = {
  top: string[];
  outer: string[];
  bottom: string[];
  shoes: string[];
  accessories: string[];
};

export type Recommendation = {
  headline: string;
  outfit: Outfit;
  reasonCodes: ReasonCode[];
  /** 표시용 문장 — reasonCodes 순서와 같다 */
  reasons: string[];
  dataQuality: DataQuality;
  analysis: {
    /** 구간 가중 체감온도 */
    weightedFeelsLike: number;
    /** 개인 보정 후 */
    adjustedFeelsLike: number;
    rangeMin: number;
    rangeMax: number;
    targetWarmth: number;
    bucket: number;
    /** 실제 조합의 보온점수 */
    outfitWarmth: number;
  };
};

/* ------------------------------------------------------- 구간 가중 체감온도 */

/** 체감온도가 없으면 기온으로 대체한다 (명세: 간소화 추천) */
function feels(h: HourPoint): number {
  return h.feelsLike ?? h.temp;
}

function hourOf(iso: string): number {
  return Number(iso.slice(11, 13));
}

/**
 * 외출 구간을 잘라낸다.
 * 시간 미설정이면 현재부터 3시간 (임의로 출퇴근 시간을 추정하지 않는다).
 *
 * targetDate('YYYY-MM-DD')를 주면 그 날짜를 분석한다. 내일 추천에 쓴다.
 * 시간이 미설정인데 미래 날짜를 보면, 지금과 같은 시각대 3시간을 그 날짜에 적용한다.
 */
export function sliceOuting(
  hourly: HourPoint[],
  settings: UserSettings,
  now: Date,
  targetDate?: string
): HourPoint[] {
  if (hourly.length === 0) return [];

  const date = targetDate ?? hourly[0].time.slice(0, 10);
  const sameDay = hourly.filter((h) => h.time.slice(0, 10) === date);
  if (sameDay.length === 0) return [];

  // 기기 시간대에 의존하지 않도록 절대 시각으로 비교한다.
  // 예보 시각은 한국 시간이고 기기는 다른 시간대일 수 있다.
  const nowMs = now.getTime();
  const notPast = (h: HourPoint) => new Date(h.time).getTime() + 3_600_000 > nowMs;

  if (!settings.departAt || !settings.returnAt) {
    const future = sameDay.filter(notPast);
    const window = (future.length > 0 ? future : sameDay).slice(0, 3);
    return window;
  }

  const d = Number(settings.departAt.slice(0, 2));
  const r = Number(settings.returnAt.slice(0, 2));

  const inWindow = sameDay.filter((h) => {
    const hh = hourOf(h.time);
    return hh >= d && hh <= r;
  });

  // 외출 시간에 해당하는 예보가 아예 없으면 그 날의 앞 3시간으로 대체
  if (inWindow.length === 0) return sameDay.slice(0, 3);

  /**
   * 이미 지나간 시간은 뺀다.
   * 오후 4시에 아침 8시 날씨로 옷을 고르면 실제보다 춥게 나온다.
   * 내일 이후는 전부 미래라 이 필터에 걸리지 않는다.
   */
  const remaining = inWindow.filter(notPast);

  // 귀가 시간이 지났으면 빈 배열 — 화면이 내일로 넘긴다
  return remaining;
}

/**
 * 구간별 가중치를 적용한 체감온도.
 * 실내 중심일수록 출퇴근 시간대가 중요하고, 야외 중심이면 전 구간이 고르게 중요하다.
 */
export function weightedFeels(slice: HourPoint[], activity: Activity): number {
  if (slice.length === 0) return 0;
  if (slice.length <= 2 || activity === 'outdoor') {
    return avg(slice.map(feels));
  }

  const head = slice.slice(0, 2); // 외출 직후 2시간
  const tail = slice.slice(-2); // 귀가 전후 2시간
  const mid = slice.slice(2, Math.max(2, slice.length - 2));

  if (mid.length === 0) return avg([...head, ...tail].map(feels));

  const w = activity === 'indoor'
    ? { head: 0.35, mid: 0.25, tail: 0.4 }
    : { head: 0.33, mid: 0.34, tail: 0.33 };

  return (
    avg(head.map(feels)) * w.head +
    avg(mid.map(feels)) * w.mid +
    avg(tail.map(feels)) * w.tail
  );
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * 의류 선택용 개인 기준값 보정. 물리적 체감온도를 다시 계산하는 게 아니다.
 * 5단계 — 온보딩 1번 문항과 1:1 대응한다.
 */
const PROFILE_ADJUST: Record<ProfileType, number> = {
  very_cold: -3,
  cold: -1.5,
  normal: 0,
  hot: 1.5,
  very_hot: 3,
};

export function personalAdjust(t: number, profile: ProfileType): number {
  return t + PROFILE_ADJUST[profile];
}

/** 바람·습도 민감도에 따른 임계값. 민감할수록 더 일찍 반응한다. */
const ENV_THRESHOLDS: Record<
  EnvSensitivity,
  { windy: number; strongWind: number; humidTemp: number; humidRh: number }
> = {
  high:   { windy: 15, strongWind: 30, humidTemp: 22, humidRh: 65 },
  normal: { windy: 25, strongWind: 40, humidTemp: 24, humidRh: 75 },
  low:    { windy: 35, strongWind: 50, humidTemp: 27, humidRh: 85 },
};

/* ------------------------------------------------------------- 구간 → 목표 */

const BUCKETS = [
  { max: 0, target: 9.5 },
  { max: 5, target: 7.5 },
  { max: 11, target: 5.5 },
  { max: 17, target: 3.5 },
  { max: 22, target: 2 },
  { max: 27, target: 1 },
  { max: Infinity, target: 0 },
];

/**
 * 목표 보온점수는 구간 대푯값이 아니라 체감온도에 따라 연속 보간한다.
 *
 * 구간 대푯값만 쓰면 두 가지가 깨진다.
 *  1) 개인 보정(±3°C)이 구간 경계를 넘지 않으면 아무 효과가 없다.
 *     18°C 보통과 18°C 더위 민감이 똑같은 옷을 받는다.
 *  2) 영하 구간이 -20°C부터 0°C까지 하나로 묶여 -1°C와 -15°C가 같아진다.
 */
const TARGET_ANCHORS: [number, number][] = [
  [-15, 12],
  [-5, 10],
  [0, 9],
  [5, 7.5],
  [11, 5.5],
  [17, 3.5],
  [22, 2],
  [27, 1],
  [32, 0],
];

export function targetWarmth(adjusted: number): number {
  const first = TARGET_ANCHORS[0];
  const last = TARGET_ANCHORS[TARGET_ANCHORS.length - 1];
  if (adjusted <= first[0]) return first[1];
  if (adjusted >= last[0]) return last[1];

  for (let i = 0; i < TARGET_ANCHORS.length - 1; i++) {
    const [x0, y0] = TARGET_ANCHORS[i];
    const [x1, y1] = TARGET_ANCHORS[i + 1];
    if (adjusted >= x0 && adjusted <= x1) {
      return round1(y0 + ((y1 - y0) * (adjusted - x0)) / (x1 - x0));
    }
  }
  return last[1];
}

export function bucketOf(adjusted: number): number {
  return BUCKETS.findIndex((b) => adjusted < b.max);
}

/** 경계에서 ±1°C 안이면 직전 구간을 유지한다 (히스테리시스) */
export function applyHysteresis(
  adjusted: number,
  bucket: number,
  previousBucket: number | null
): number {
  if (previousBucket === null || previousBucket === bucket) return bucket;
  if (Math.abs(previousBucket - bucket) !== 1) return bucket;

  const boundary = BUCKETS[Math.min(previousBucket, bucket)].max;
  if (Math.abs(adjusted - boundary) <= 1) return previousBucket;
  return bucket;
}

/* --------------------------------------------------------- 구간별 후보 풀 */

type Pool = { tops: string[]; outers: string[]; bottoms: string[]; shoes: string[] };

const POOLS: Pool[] = [
  { // 0: 0°C 미만
    tops: ['knit', 'hoodie', 'thin_knit', 'knit_onepiece'],
    outers: ['heavy_padding', 'padding'],
    bottoms: ['corduroy_pants', 'leggings'],
    shoes: ['boots'],
  },
  { // 1: 0~5
    tops: ['knit', 'hoodie', 'knit_onepiece'],
    outers: ['padding', 'coat'],
    bottoms: ['corduroy_pants', 'jeans', 'leggings'],
    shoes: ['boots', 'sneakers'],
  },
  { // 2: 5~11
    tops: ['knit', 'hoodie', 'thin_knit', 'knit_onepiece'],
    outers: ['coat', 'light_padding'],
    bottoms: ['jeans', 'long_pants', 'corduroy_pants', 'wide_pants', 'leggings'],
    shoes: ['sneakers', 'dress_shoes', 'boots', 'flats'],
  },
  { // 3: 11~17
    tops: ['long_tee', 'thin_knit', 'thin_shirt', 'sweatshirt', 'blouse'],
    outers: ['light_jacket', 'cardigan', 'trench_coat'],
    bottoms: ['jeans', 'long_pants', 'wide_pants', 'long_skirt'],
    shoes: ['sneakers', 'dress_shoes', 'flats'],
  },
  { // 4: 17~22
    tops: ['long_tee', 'thin_shirt', 'short_tee', 'blouse', 'onepiece'],
    outers: ['cardigan', 'light_jacket'],
    bottoms: ['jeans', 'sweatpants', 'long_pants', 'wide_pants', 'long_skirt'],
    shoes: ['sneakers', 'dress_shoes', 'flats'],
  },
  { // 5: 22~27
    tops: ['short_tee', 'thin_shirt', 'onepiece'],
    outers: [],
    bottoms: ['jeans', 'shorts', 'long_pants', 'skirt'],
    shoes: ['sneakers', 'flats', 'sandals'],
  },
  { // 6: 27°C 이상
    tops: ['short_tee', 'sleeveless', 'onepiece'],
    outers: [],
    bottoms: ['shorts', 'skirt'],
    shoes: ['flip_flops', 'sneakers', 'sandals'],
  },
];

const STYLE_FORMALITY: Record<Style, number> = {
  casual: 1,
  sporty: 1,
  minimal: 2,
  office: 3,
};

const topById = (id: string) => TOPS.find((t) => t.id === id)!;
const outerById = (id: string) => OUTERS.find((o) => o.id === id)!;
const bottomById = (id: string) => BOTTOMS.find((b) => b.id === id)!;
const shoesById = (id: string) => SHOES.find((s) => s.id === id)!;

/* --------------------------------------------------------------- 조합 선택 */

type Constraints = {
  needRemovable: boolean;
  needWaterproofOuter: boolean;
  needWindproofOuter: boolean;
  needBreathableTop: boolean;
  needWaterproofShoes: boolean;
  needAntiSlipShoes: boolean;
};

const NO_CONSTRAINTS: Constraints = {
  needRemovable: false,
  needWaterproofOuter: false,
  needWindproofOuter: false,
  needBreathableTop: false,
  needWaterproofShoes: false,
  needAntiSlipShoes: false,
};

function outfitWarmth(tops: Top[], outer: Outer | null, bottom: Bottom | null): number {
  const t = tops.reduce((a, b) => a + b.warmth, 0);
  // 원피스는 그 자체로 하체까지 덮으므로 하의가 없어도 보온이 모자라지 않다
  const fullBody = tops.some((x) => x.fullBody);
  const base = t + (outer?.warmth ?? 0) + (bottom ? bottom.warmth * 0.5 : 0);
  return fullBody && !bottom ? base + 0.5 : base;
}

/**
 * 후보 풀에서 목표 보온점수에 가장 가까운 조합을 고른다.
 * 동점이면 스타일이 가까운 쪽, 그래도 같으면 id 사전순 — 항상 같은 답이 나온다.
 */
function pickOutfit(
  bucket: number,
  target: number,
  style: Style,
  c: Constraints,
  gender: 'female' | 'male'
): { tops: Top[]; outer: Outer | null; bottom: Bottom | null; shoes: Shoes } {
  const pool = POOLS[bucket];
  const wantF = STYLE_FORMALITY[style];
  const ok = <T extends { gender?: 'unisex' | 'female' | 'male' }>(i: T) =>
    fitsGender(i, gender);

  // 상의 후보 — 겹쳐 입기는 0번 구간(영하)에서만
  const poolTops = pool.tops.map(topById).filter(ok);
  let topCandidates: Top[][] = poolTops.map((t) => [t]);
  if (bucket <= 1) {
    const layers: Top[][] = [];
    for (const inner of poolTops) {
      if (!inner.layerable) continue;
      for (const outerTop of poolTops) {
        if (outerTop.id === inner.id) continue;
        layers.push([inner, outerTop]);
      }
    }
    topCandidates = [...topCandidates, ...layers];
  }
  if (c.needBreathableTop) {
    const b = topCandidates.filter((ts) => ts.every((t) => t.breathable));
    if (b.length > 0) topCandidates = b;
  }

  // 아우터 후보
  const poolOuters = pool.outers.map(outerById).filter(ok);
  let outerCandidates: (Outer | null)[] =
    poolOuters.length === 0 ? [null] : poolOuters;
  if (bucket === 4) outerCandidates = [...outerCandidates, null]; // 17~22는 선택
  if (c.needWaterproofOuter) {
    const w = [...outerCandidates, outerById('rain_jacket')].filter(
      (o): o is Outer => o !== null && o.waterproof
    );
    if (w.length > 0) outerCandidates = w;
  }
  if (c.needWindproofOuter) {
    const w = outerCandidates.filter((o) => o !== null && o.windproof);
    if (w.length > 0) outerCandidates = w;
  }
  if (c.needRemovable) {
    const r = outerCandidates.filter((o) => o !== null && o.removability === 3);
    if (r.length > 0) outerCandidates = r;
  }

  const bottomCandidates = pool.bottoms.map(bottomById).filter(ok);
  /**
   * 원피스를 골랐을 땐 하의를 생략하거나 레깅스만 덧입는다.
   * 다만 쌀쌀한 구간(11°C 미만)에서는 맨다리로 둘 수 없어 레깅스를 강제한다.
   */
  const leggings = bottomCandidates.find((b) => b.id === 'leggings');
  const needsLegs = bucket <= 2;
  const fullBodyBottoms: (Bottom | null)[] = leggings
    ? (needsLegs ? [leggings] : [null, leggings])
    : (needsLegs ? bottomCandidates : [null]);

  // 신발
  let shoeCandidates = pool.shoes.map(shoesById).filter(ok);
  if (c.needAntiSlipShoes) {
    const a = [...shoeCandidates, shoesById('boots')].filter((s) => s.antiSlip);
    if (a.length > 0) shoeCandidates = a;
  } else if (c.needWaterproofShoes) {
    const w = [...shoeCandidates, shoesById('boots')].filter((s) => s.waterproof);
    if (w.length > 0) shoeCandidates = w;
  }

  let best: {
    tops: Top[]; outer: Outer | null; bottom: Bottom | null; shoes: Shoes; cost: number; key: string;
  } | null = null;

  for (const tops of topCandidates) {
    const isFullBody = tops.some((t) => t.fullBody);
    const bottoms: (Bottom | null)[] = isFullBody ? fullBodyBottoms : bottomCandidates;
    for (const outer of outerCandidates) {
      for (const bottom of bottoms) {
        for (const shoes of shoeCandidates) {
          const warmth = outfitWarmth(tops, outer, bottom);
          const all = [...tops, ...(outer ? [outer] : []), ...(bottom ? [bottom] : []), shoes];
          const styleCost = all.reduce((a, i) => a + Math.abs(i.formality - wantF), 0);
          const cost = Math.abs(warmth - target) * 10 + styleCost;
          const key = [...tops.map((t) => t.id), outer?.id ?? '', bottom?.id ?? '-', shoes.id].join('|');
          if (!best || cost < best.cost || (cost === best.cost && key < best.key)) {
            best = { tops, outer, bottom, shoes, cost, key };
          }
        }
      }
    }
  }

  // 풀은 항상 비어 있지 않도록 구성되어 있다
  return best!;
}

/* ----------------------------------------------------------- 사유 문장 매핑 */

const REASON_TEXT: Record<ReasonCode, string> = {
  SEVERE_COLD: '한파예요. 목도리와 장갑을 챙기세요.',
  COOL_MORNING: '아침에는 쌀쌀해요.',
  TEMPERATURE_DROP: '저녁에 기온이 떨어져요.',
  WIDE_RANGE: '일교차가 커요. 벗기 편한 겉옷이 좋아요.',
  HEAVY_RAIN: '비가 많이 와요. 방수 겉옷을 추천해요.',
  RAIN_POSSIBLE: '비 올 가능성이 있어요.',
  SNOW: '눈이 와요. 미끄럼에 주의하세요.',
  STRONG_WIND: '바람이 매우 강해요.',
  WINDY: '바람이 불어요. 방풍 겉옷이 좋아요.',
  DUST_VERY_HIGH: '미세먼지가 매우 나빠요. 마스크를 꼭 챙기세요.',
  DUST_HIGH: '미세먼지가 나빠요. 마스크를 챙기세요.',
  HUMID: '습해요. 통기성 좋은 옷을 추천해요.',
  UV_HIGH: '자외선이 강해요. 차단제와 모자를 챙기세요.',
  UV_MODERATE: '자외선이 있어요. 차단제를 바르세요.',
  AC_INDOOR: '실내 냉방에 대비해 얇은 겉옷을 챙기세요.',
  PROFILE_COLD: '추위를 타는 편이라 겉옷을 더했어요.',
  PROFILE_HOT: '더위를 타는 편이라 가볍게 맞췄어요.',
};

/** 표시 우선순위 — 위에서부터 최대 3개 */
const REASON_PRIORITY: ReasonCode[] = [
  'SEVERE_COLD',
  'HEAVY_RAIN',
  'SNOW',
  'DUST_VERY_HIGH',
  'STRONG_WIND',
  'WIDE_RANGE',
  'TEMPERATURE_DROP',
  'COOL_MORNING',
  'RAIN_POSSIBLE',
  'DUST_HIGH',
  'WINDY',
  'HUMID',
  'UV_HIGH',
  'UV_MODERATE',
  'AC_INDOOR',
  'PROFILE_COLD',
  'PROFILE_HOT',
];

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/* ------------------------------------------------------------------ 본체 */

export type RecommendInput = {
  hourly: HourPoint[];
  settings: UserSettings;
  air?: AirQuality | null;
  now?: Date;
  /** 분석할 날짜 'YYYY-MM-DD'. 생략하면 예보의 첫 날(=오늘) */
  targetDate?: string;
  /** 직전 추천의 구간 — 히스테리시스용 */
  previousBucket?: number | null;
  /** 날씨 데이터가 오래됐는지 */
  stale?: boolean;
};

export function recommend(input: RecommendInput): Recommendation {
  const { hourly, settings, air = null, now = new Date(), previousBucket = null } = input;

  const slice = sliceOuting(hourly, settings, now, input.targetDate);
  if (slice.length === 0) {
    throw new Error('해당 날짜의 예보가 없습니다');
  }

  const feelsValues = slice.map(feels);
  const rangeMin = Math.min(...feelsValues);
  const rangeMax = Math.max(...feelsValues);

  const weighted = weightedFeels(slice, settings.activity);
  const adjusted = personalAdjust(weighted, settings.profileType);

  const rawBucket = bucketOf(adjusted);
  const bucket = applyHysteresis(adjusted, rawBucket, previousBucket);
  const target = targetWarmth(adjusted);

  /* --- 환경 조건 판정 --- */
  const maxPrecipProb = Math.max(...slice.map((h) => h.precipProb));
  const maxPrecipAmount = Math.max(...slice.map((h) => h.precipAmount));
  const maxWind = Math.max(...slice.map((h) => h.wind));
  const maxGust = Math.max(...slice.map((h) => h.windGust ?? h.wind));
  const maxHumidity = Math.max(...slice.map((h) => h.humidity));
  const maxTemp = Math.max(...slice.map((h) => h.temp));
  const dayUv = slice.filter((h) => h.isDay).map((h) => h.uvIndex);
  const hasUv = dayUv.some((u) => u !== null);
  const maxUv = hasUv ? Math.max(...dayUv.map((u) => u ?? 0)) : null;
  const snowing = slice.some((h) => SNOW_CODES.has(h.weatherCode));
  const pm25 = air?.pm25 ?? null;

  const codes: ReasonCode[] = [];
  const push = (c: ReasonCode) => { if (!codes.includes(c)) codes.push(c); };

  const constraints: Constraints = { ...NO_CONSTRAINTS };

  if (adjusted <= -5) push('SEVERE_COLD');

  if (maxPrecipAmount >= 5) {
    push('HEAVY_RAIN');
    constraints.needWaterproofOuter = true;
    constraints.needWaterproofShoes = true;
  } else if (maxPrecipProb >= 50) {
    push('RAIN_POSSIBLE');
  }

  if (snowing) {
    push('SNOW');
    constraints.needAntiSlipShoes = true;
  }

  const env = ENV_THRESHOLDS[settings.envSensitivity];

  if (maxGust >= env.strongWind || maxWind >= env.strongWind) {
    push('STRONG_WIND');
    constraints.needWindproofOuter = true;
  } else if (maxWind >= env.windy) {
    push('WINDY');
    constraints.needWindproofOuter = true;
  }

  if (maxTemp >= env.humidTemp && maxHumidity >= env.humidRh) {
    push('HUMID');
    constraints.needBreathableTop = true;
  }

  if (pm25 !== null) {
    if (pm25 >= 76) push('DUST_VERY_HIGH');
    else if (pm25 >= 36) push('DUST_HIGH');
  }

  if (maxUv !== null) {
    if (maxUv >= 6) push('UV_HIGH');
    else if (maxUv >= 3) push('UV_MODERATE');
  }

  // 일교차 — 단순 일최고·최저가 아니라 외출 구간의 체감 변화
  const wideRange = rangeMax - rangeMin >= 7;
  if (wideRange) {
    push('WIDE_RANGE');
    constraints.needRemovable = true;
  }

  // 시간대 패턴
  if (slice.length >= 4) {
    const headAvg = avg(slice.slice(0, 2).map(feels));
    const tailAvg = avg(slice.slice(-2).map(feels));
    if (headAvg <= avg(feelsValues) - 3) push('COOL_MORNING');
    if (tailAvg <= rangeMax - 5) push('TEMPERATURE_DROP');
  }

  const feelsHot =
    settings.profileType === 'hot' || settings.profileType === 'very_hot';
  if (feelsHot && weighted >= 27) push('AC_INDOOR');

  /* --- 조합 선택 --- */
  const picked = pickOutfit(bucket, target, settings.style, constraints, settings.gender);

  // 개인 보정이 실제로 조합을 바꿨을 때만 PROFILE_* 를 붙인다.
  // 구간이 바뀌었는지가 아니라 결과물이 달라졌는지로 판단한다 —
  // 바뀐 게 없는데 "성향을 반영했어요"라고 하면 신뢰를 잃는다.
  if (settings.profileType !== 'normal') {
    const neutral = pickOutfit(
      bucketOf(weighted),
      targetWarmth(weighted),
      settings.style,
      constraints,
      settings.gender
    );
    if (outfitKey(neutral) !== outfitKey(picked)) {
      const feelsCold =
        settings.profileType === 'cold' || settings.profileType === 'very_cold';
      push(feelsCold ? 'PROFILE_COLD' : 'PROFILE_HOT');
    }
  }

  /* --- 준비물 --- */
  const accessories: string[] = [];
  const addAcc = (id: string) => { if (!accessories.includes(id)) accessories.push(id); };

  if (codes.includes('HEAVY_RAIN') || codes.includes('RAIN_POSSIBLE')) addAcc('umbrella');
  if (codes.includes('SEVERE_COLD')) { addAcc('scarf'); addAcc('gloves'); addAcc('beanie'); }
  if (codes.includes('UV_HIGH')) { addAcc('sunscreen'); addAcc('cap'); addAcc('sunglasses'); }
  else if (codes.includes('UV_MODERATE')) { addAcc('sunscreen'); addAcc('cap'); }
  if (codes.includes('DUST_VERY_HIGH') || codes.includes('DUST_HIGH')) addAcc('mask');
  if (codes.includes('AC_INDOOR')) addAcc('cardigan');

  const ordered = REASON_PRIORITY.filter((c) => codes.includes(c));
  const shown = ordered.slice(0, 3);

  const dataQuality: DataQuality = input.stale
    ? 'stale'
    : slice.some((h) => h.feelsLike === null) || !hasUv || pm25 === null
      ? 'partial'
      : 'full';

  return {
    headline: headlineFor(ordered[0] ?? null, picked.outer),
    outfit: {
      top: picked.tops.map((t) => t.id),
      outer: picked.outer ? [picked.outer.id] : [],
      bottom: picked.bottom ? [picked.bottom.id] : [],
      shoes: [picked.shoes.id],
      accessories,
    },
    reasonCodes: shown,
    reasons: shown.map((c) => REASON_TEXT[c]),
    dataQuality,
    analysis: {
      weightedFeelsLike: round1(weighted),
      adjustedFeelsLike: round1(adjusted),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
      targetWarmth: target,
      bucket,
      outfitWarmth: outfitWarmth(picked.tops, picked.outer, picked.bottom),
    },
  };
}

function headlineFor(top: ReasonCode | null, outer: Outer | null): string {
  switch (top) {
    case 'SEVERE_COLD': return '단단히 챙겨 입으세요';
    case 'HEAVY_RAIN': return '방수 겉옷과 우산을 챙기세요';
    case 'RAIN_POSSIBLE': return '우산을 챙기세요';
    case 'SNOW': return '눈길에 대비하세요';
    case 'DUST_VERY_HIGH':
    case 'DUST_HIGH': return '마스크를 챙기세요';
    case 'STRONG_WIND':
    case 'WINDY': return '바람을 막아줄 겉옷이 좋아요';
    case 'WIDE_RANGE':
    case 'TEMPERATURE_DROP':
    case 'COOL_MORNING': return '벗기 편한 겉옷을 챙기세요';
    case 'HUMID': return '통기성 좋은 옷을 입으세요';
    case 'UV_HIGH':
    case 'UV_MODERATE': return '자외선을 막아주세요';
    case 'AC_INDOOR': return '실내 냉방에 대비하세요';
    default:
      return outer ? `${outer.nameKo}을 챙기세요` : '가볍게 입으세요';
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function outfitKey(p: { tops: Top[]; outer: Outer | null; bottom: Bottom | null; shoes: Shoes }): string {
  return [...p.tops.map((t) => t.id), p.outer?.id ?? '-', p.bottom?.id ?? '-', p.shoes.id].join('|');
}

export { ACCESSORIES, BUCKETS };
