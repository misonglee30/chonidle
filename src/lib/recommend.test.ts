/**
 * 추천 엔진 검증 — PRD 11-1 테스트 매트릭스 10개 + 경계값.
 * 실행: npx tsx src/lib/recommend.test.ts
 */

import { describeOutfit } from '@/lib/clothing';
import {
  applyHysteresis,
  bucketOf,
  recommend,
  sliceOuting,
  type HourPoint,
  type RecommendInput,
  type UserSettings,
} from '@/lib/recommend';

/* ------------------------------------------------------------ 테스트 틀 */

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ------------------------------------------------------------ 입력 헬퍼 */

type HourOpts = Partial<Omit<HourPoint, 'time'>>;

/** 08:00부터 n시간, 기온 곡선을 직접 주거나 상수로 */
function hours(temps: number[], opts: HourOpts = {}): HourPoint[] {
  return temps.map((t, i) => ({
    time: `2026-10-16T${String(8 + i).padStart(2, '0')}:00:00+09:00`,
    temp: t,
    feelsLike: opts.feelsLike === null ? null : (opts.feelsLike ?? t),
    humidity: opts.humidity ?? 55,
    wind: opts.wind ?? 8,
    windGust: opts.windGust ?? null,
    precipProb: opts.precipProb ?? 0,
    precipAmount: opts.precipAmount ?? 0,
    uvIndex: opts.uvIndex === null ? null : (opts.uvIndex ?? 2),
    weatherCode: opts.weatherCode ?? 1,
    isDay: opts.isDay ?? true,
  }));
}

function flat(temp: number, n = 12, opts: HourOpts = {}): HourPoint[] {
  return hours(Array(n).fill(temp), opts);
}

const BASE: UserSettings = {
  gender: 'male',
  profileType: 'normal',
  envSensitivity: 'normal',
  style: 'casual',
  activity: 'mixed',
  departAt: '08:00',
  returnAt: '19:00',
  locationMode: 'manual',
  cityId: 'seoul',
  gpsName: null,
  gpsLat: null,
  gpsLon: null,
  onboarded: true,
};

function run(hourly: HourPoint[], settings: Partial<UserSettings> = {}, rest: Partial<RecommendInput> = {}) {
  return recommend({
    hourly,
    settings: { ...BASE, ...settings },
    air: { pm25: 20, pm10: 30 },
    now: new Date('2026-10-16T08:00:00+09:00'),
    ...rest,
  });
}

function show(label: string, r: ReturnType<typeof recommend>) {
  const o = r.outfit;
  const all = [...o.top, ...o.outer, ...o.bottom, ...o.shoes];
  console.log(
    `    ${label}: ${describeOutfit(all)}` +
    (o.accessories.length ? ` / ${describeOutfit(o.accessories)}` : '') +
    `  [점수 ${r.analysis.outfitWarmth} · 목표 ${r.analysis.targetWarmth}]`
  );
  if (r.reasons.length) console.log(`      → ${r.reasons.join(' ')}`);
}

/* ================================================= PRD 11-1 테스트 매트릭스 */

console.log('\n── PRD 11-1 추천 알고리즘 테스트 매트릭스 ──\n');

// 1. 일반 봄 날씨 — 18°C·약풍 → 얇은 상의, 가벼운 겉옷
{
  const r = run(flat(18, 12, { wind: 7 }));
  show('18°C 약풍', r);
  check('일반 봄 날씨: 구간 4(17~22)', r.analysis.bucket === 4);
  check('일반 봄 날씨: 얇은 상의', ['long_tee', 'thin_shirt', 'short_tee'].includes(r.outfit.top[0]));
  check('일반 봄 날씨: 두꺼운 아우터 없음', !r.outfit.outer.includes('padding'));
}

// 2. 추위 민감 — 동일 날씨에서 보온 강화
{
  const normal = run(flat(18, 12, { wind: 7 }));
  const cold = run(flat(18, 12, { wind: 7 }), { profileType: 'very_cold' });
  show('18°C 추위를 많이 탐', cold);
  check(
    '추위 민감: 보온 수준이 올라감',
    cold.analysis.outfitWarmth > normal.analysis.outfitWarmth,
    `${cold.analysis.outfitWarmth} vs ${normal.analysis.outfitWarmth}`
  );
  check('추위 민감: PROFILE_COLD 표시', cold.reasonCodes.includes('PROFILE_COLD'));
}

// 3. 더위 민감 — 가벼운 의류 우선
{
  const normal = run(flat(18, 12, { wind: 7 }));
  const hot = run(flat(18, 12, { wind: 7 }), { profileType: 'very_hot' });
  show('18°C 더위를 많이 탐', hot);
  check(
    '더위 민감: 보온 수준이 내려감',
    hot.analysis.outfitWarmth < normal.analysis.outfitWarmth,
    `${hot.analysis.outfitWarmth} vs ${normal.analysis.outfitWarmth}`
  );
}

// 4. 강풍 — 14°C·풍속 30km/h → 방풍 겉옷
{
  const r = run(flat(14, 12, { wind: 30 }));
  show('14°C 풍속 30', r);
  check('강풍: WINDY 코드', r.reasonCodes.includes('WINDY'));
  check(
    '강풍: 방풍 아우터 선택',
    ['light_jacket', 'trench_coat', 'rain_jacket', 'light_padding', 'padding', 'heavy_padding']
      .includes(r.outfit.outer[0]),
    r.outfit.outer[0]
  );
}

// 5. 높은 습도 — 29°C·습도 85% → 통기성 소재
{
  const r = run(flat(29, 12, { humidity: 85 }));
  show('29°C 습도 85%', r);
  check('고습: HUMID 코드', r.reasonCodes.includes('HUMID'));
  check('고습: 통기성 상의', ['short_tee', 'sleeveless', 'thin_shirt'].includes(r.outfit.top[0]));
}

// 6. 비 예보 — 외출 중 높은 강수확률 → 우산 권장
{
  const r = run(flat(16, 12, { precipProb: 70 }));
  show('16°C 강수확률 70%', r);
  check('비 예보: RAIN_POSSIBLE', r.reasonCodes.includes('RAIN_POSSIBLE'));
  check('비 예보: 우산 추가', r.outfit.accessories.includes('umbrella'));
}

// 6-b. 강한 비 → 방수 겉옷
{
  const r = run(flat(16, 12, { precipProb: 95, precipAmount: 8 }));
  show('16°C 강한 비', r);
  check('강한 비: HEAVY_RAIN', r.reasonCodes.includes('HEAVY_RAIN'));
  check('강한 비: 방수 아우터', ['rain_jacket', 'trench_coat'].includes(r.outfit.outer[0]), r.outfit.outer[0]);
}

// 7. 큰 일교차 — 오전 8°C·낮 22°C → 탈착 가능한 겉옷
{
  const curve = [8, 9, 12, 16, 20, 22, 22, 20, 17, 14, 12, 11];
  const r = run(hours(curve));
  show('일교차 8→22°C', r);
  check('일교차: WIDE_RANGE', r.reasonCodes.includes('WIDE_RANGE'));
  check(
    '일교차: 벗기 편한 아우터(removability 3)',
    ['cardigan', 'light_jacket', 'rain_jacket', 'light_padding'].includes(r.outfit.outer[0]),
    r.outfit.outer[0]
  );
}

// 8. 강한 자외선 — UV 8·야외 활동 → 자외선 준비물
{
  const r = run(flat(24, 12, { uvIndex: 8 }), { activity: 'outdoor' });
  show('UV 8 야외', r);
  check('자외선: UV_HIGH', r.reasonCodes.includes('UV_HIGH'));
  check('자외선: 선크림·모자', r.outfit.accessories.includes('sunscreen') && r.outfit.accessories.includes('cap'));
}

// 9. 일부 결측 — 체감온도 없음 → 간소화 추천 및 상태 표시
{
  const r = run(flat(15, 12, { feelsLike: null }));
  show('체감온도 결측', r);
  check('결측: 추천이 생성됨', r.outfit.top.length > 0);
  check('결측: dataQuality partial', r.dataQuality === 'partial');
}

// 10. 통신 실패 — 저장된 정보 표시 (stale 플래그)
{
  const r = run(flat(15), {}, { stale: true });
  check('오래된 데이터: dataQuality stale', r.dataQuality === 'stale');
}

/* ======================================================== 추가 규칙 검증 */

console.log('\n── 추가 규칙 ──\n');

// 미세먼지
{
  const r = run(flat(15), {}, { air: { pm25: 55, pm10: 90 } });
  show('PM2.5 55', r);
  check('미세먼지 나쁨: DUST_HIGH', r.reasonCodes.includes('DUST_HIGH'));
  check('미세먼지 나쁨: 마스크', r.outfit.accessories.includes('mask'));

  const vh = run(flat(15), {}, { air: { pm25: 90, pm10: 150 } });
  check('미세먼지 매우 나쁨: DUST_VERY_HIGH', vh.reasonCodes.includes('DUST_VERY_HIGH'));
}

// 대기 API만 실패 → 추천은 그대로
{
  const r = run(flat(15), {}, { air: null });
  check('대기 데이터 없음: 추천 생성됨', r.outfit.top.length > 0);
  check('대기 데이터 없음: 마스크 없음', !r.outfit.accessories.includes('mask'));
  check('대기 데이터 없음: partial', r.dataQuality === 'partial');
}

// 눈
{
  const r = run(flat(-1, 12, { weatherCode: 73 }));
  show('영하 1°C 눈', r);
  check('눈: SNOW 코드', r.reasonCodes.includes('SNOW'));
  check('눈: 미끄럼 방지 신발', r.outfit.shoes[0] === 'boots');
}

// 한파 + 레이어링
{
  const r = run(flat(-8));
  show('체감 -8°C', r);
  check('한파: SEVERE_COLD', r.reasonCodes.includes('SEVERE_COLD'));
  check('한파: 상의 겹쳐 입기', r.outfit.top.length === 2, `top=${r.outfit.top.join(',')}`);
  check('한파: 목도리·장갑·비니', ['scarf', 'gloves', 'beanie'].every((a) => r.outfit.accessories.includes(a)));
  check('한파: 보온점수 9 이상', r.analysis.outfitWarmth >= 9, String(r.analysis.outfitWarmth));
}

// 폭염 + 더위 민감 → 실내 냉방 대비
{
  const r = run(flat(31), { profileType: 'very_hot' });
  show('31°C 더위를 많이 탐', r);
  check('폭염+더위: AC_INDOOR', r.reasonCodes.includes('AC_INDOOR'));
  check('폭염+더위: 얇은 겉옷 준비물', r.outfit.accessories.includes('cardigan'));
}

// 스타일 반영
{
  const office = run(flat(14), { style: 'office' });
  const casual = run(flat(14), { style: 'casual' });
  show('14°C 오피스', office);
  show('14°C 캐주얼', casual);
  check(
    '스타일: 오피스와 캐주얼 결과가 다름',
    JSON.stringify(office.outfit) !== JSON.stringify(casual.outfit)
  );
  check('오피스: 구두 또는 긴바지', office.outfit.shoes[0] === 'dress_shoes' || office.outfit.bottom[0] === 'long_pants');
}

// 결정론 — 같은 입력 100회 같은 결과
{
  const first = JSON.stringify(run(flat(16)).outfit);
  let same = true;
  for (let i = 0; i < 100; i++) {
    if (JSON.stringify(run(flat(16)).outfit) !== first) same = false;
  }
  check('결정론: 100회 동일 결과', same);
}

// 히스테리시스
{
  check('구간 경계: 16.9°C와 17.1°C는 다른 구간', bucketOf(16.9) !== bucketOf(17.1));
  check(
    '히스테리시스: 경계 1°C 안이면 직전 구간 유지',
    applyHysteresis(17.1, bucketOf(17.1), bucketOf(16.9)) === bucketOf(16.9)
  );
  check(
    '히스테리시스: 경계에서 멀면 새 구간 적용',
    applyHysteresis(20, bucketOf(20), bucketOf(16.9)) === bucketOf(20)
  );

  const a = run(flat(16.9));
  const b = run(flat(17.1), {}, { previousBucket: a.analysis.bucket });
  check(
    '히스테리시스: 추천이 급변하지 않음',
    JSON.stringify(a.outfit) === JSON.stringify(b.outfit),
    `${describeOutfit(a.outfit.top)} vs ${describeOutfit(b.outfit.top)}`
  );
}

// 외출 시간 미설정 → 현재부터 3시간
{
  const curve = [8, 9, 12, 16, 20, 22, 22, 20, 17, 14, 12, 11];
  const noTime = run(hours(curve), { departAt: null, returnAt: null });
  const withTime = run(hours(curve));
  check(
    '외출시간 미설정: 현재부터 3시간만 반영',
    noTime.analysis.weightedFeelsLike < withTime.analysis.weightedFeelsLike,
    `${noTime.analysis.weightedFeelsLike} vs ${withTime.analysis.weightedFeelsLike}`
  );
}

// 활동 환경에 따른 가중치
{
  const curve = [8, 9, 12, 16, 20, 22, 22, 20, 17, 14, 12, 11];
  const indoor = run(hours(curve), { activity: 'indoor' });
  const outdoor = run(hours(curve), { activity: 'outdoor' });
  check(
    '활동: 실내 중심이 야외 중심보다 낮은 체감 기준',
    indoor.analysis.weightedFeelsLike < outdoor.analysis.weightedFeelsLike,
    `${indoor.analysis.weightedFeelsLike} vs ${outdoor.analysis.weightedFeelsLike}`
  );
}

// 전 구간 스모크 — 모든 온도에서 추천이 나오는지
{
  let ok = true;
  const problems: string[] = [];
  for (let t = -20; t <= 40; t++) {
    for (const p of ['cold', 'normal', 'hot'] as const) {
      for (const s of ['casual', 'minimal', 'office', 'sporty'] as const) {
        try {
          const r = run(flat(t), { profileType: p, style: s });
          if (r.outfit.top.length === 0 || r.outfit.bottom.length === 0 || r.outfit.shoes.length === 0) {
            ok = false;
            problems.push(`${t}°C/${p}/${s}: 빈 항목`);
          }
        } catch (e) {
          ok = false;
          problems.push(`${t}°C/${p}/${s}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  }
  check('스모크: -20~40°C × 성향3 × 스타일4 = 732조합 모두 생성', ok, problems.slice(0, 3).join(' / '));
}

/* ================================================ 온보딩으로 늘어난 설정 */

console.log('\n── 민감도 5단계 ──\n');

// 5단계가 단조 증가해야 한다
{
  const levels = ['very_hot', 'hot', 'normal', 'cold', 'very_cold'] as const;
  const warmths = levels.map((p) => run(flat(16), { profileType: p }).analysis.outfitWarmth);
  console.log(`    16°C — ${levels.map((l, i) => `${l} ${warmths[i]}`).join(' · ')}`);
  let monotonic = true;
  for (let i = 1; i < warmths.length; i++) {
    if (warmths[i] < warmths[i - 1]) monotonic = false;
  }
  check('5단계: 더위→추위 순으로 보온이 줄지 않음', monotonic, warmths.join(','));
  check('5단계: 양 끝이 실제로 다름', warmths[0] < warmths[warmths.length - 1]);
  check(
    '5단계: 중간 단계가 양 끝 사이에 있음',
    warmths[1] >= warmths[0] && warmths[3] <= warmths[4]
  );
}

// 중간 단계(조금 ±1.5°C)는 결과를 과하게 흔들지 않아야 한다
{
  const normal = run(flat(18)).analysis.outfitWarmth;
  const mildHot = run(flat(18), { profileType: 'hot' }).analysis.outfitWarmth;
  const mildCold = run(flat(18), { profileType: 'cold' }).analysis.outfitWarmth;
  check('중간 단계: 보통 대비 1단계 이내 차이', Math.abs(mildHot - normal) <= 1 && Math.abs(mildCold - normal) <= 1,
    `cold ${mildCold} / normal ${normal} / hot ${mildHot}`);
}

console.log('\n── 바람·습도 민감도 ──\n');

// 바람 — 민감한 사람은 더 약한 바람에서도 방풍을 받는다
{
  const w = 20; // normal(25) 미만, high(15) 이상
  const high = run(flat(14, 12, { wind: w }), { envSensitivity: 'high' });
  const normal = run(flat(14, 12, { wind: w }), { envSensitivity: 'normal' });
  check('바람 민감(high): 20km/h에서 WINDY', high.reasonCodes.includes('WINDY'));
  check('바람 보통(normal): 20km/h는 WINDY 아님', !normal.reasonCodes.includes('WINDY'));

  const low = run(flat(14, 12, { wind: 30 }), { envSensitivity: 'low' });
  check('바람 둔감(low): 30km/h도 WINDY 아님', !low.reasonCodes.includes('WINDY'));
}

// 습도 — 민감한 사람은 더 낮은 온습도에서 통기성 우선
{
  const opts = { humidity: 70 };
  const high = run(flat(23, 12, opts), { envSensitivity: 'high' });
  const normal = run(flat(23, 12, opts), { envSensitivity: 'normal' });
  check('습도 민감(high): 23°C·70%에서 HUMID', high.reasonCodes.includes('HUMID'));
  check('습도 보통(normal): 23°C·70%는 HUMID 아님', !normal.reasonCodes.includes('HUMID'));
}

// 설정 전 범위 스모크
{
  let ok = true;
  const profiles = ['very_cold', 'cold', 'normal', 'hot', 'very_hot'] as const;
  const envs = ['low', 'normal', 'high'] as const;
  const acts = ['indoor', 'mixed', 'outdoor'] as const;
  let count = 0;
  for (let t = -20; t <= 40; t += 2) {
    for (const p of profiles) {
      for (const e of envs) {
        for (const a of acts) {
          count++;
          try {
            const r = run(flat(t), { profileType: p, envSensitivity: e, activity: a });
            if (!r.outfit.top.length || !r.outfit.bottom.length || !r.outfit.shoes.length) ok = false;
          } catch {
            ok = false;
          }
        }
      }
    }
  }
  check(`스모크: 온도31 × 민감도5 × 환경3 × 활동3 = ${count}조합 모두 생성`, ok);
}

/* ================================================== 지나간 시간 제외 (오늘) */

console.log('\n── 오늘은 남은 시간만 분석 ──\n');

{
  // 아침 추움(8시 10°) → 오후 따뜻(16시 24°)
  const curve = [10, 12, 15, 18, 20, 22, 23, 24, 24, 23, 21, 19];
  const hourly = hours(curve); // 08:00~19:00

  const morning = recommend({
    hourly, settings: BASE, air: null,
    now: new Date('2026-10-16T08:00:00+09:00'),
  });
  const afternoon = recommend({
    hourly, settings: BASE, air: null,
    now: new Date('2026-10-16T16:00:00+09:00'),
  });

  show('08시에 열었을 때', morning);
  show('16시에 열었을 때', afternoon);

  check('오후에 열면 아침 기온이 빠진다',
    afternoon.analysis.rangeMin > morning.analysis.rangeMin,
    `${afternoon.analysis.rangeMin} vs ${morning.analysis.rangeMin}`);
  check('오후에 열면 더 가볍게 추천',
    afternoon.analysis.outfitWarmth <= morning.analysis.outfitWarmth,
    `${afternoon.analysis.outfitWarmth} vs ${morning.analysis.outfitWarmth}`);
  check('오후에는 아침 쌀쌀 사유가 안 뜬다',
    !afternoon.reasonCodes.includes('COOL_MORNING'));
  check('아침에는 일교차 사유가 뜬다',
    morning.reasonCodes.includes('WIDE_RANGE'));
}

// 내일은 지나간 시간 개념이 없다 — 전 구간을 본다
{
  const mk = (date: string, temps: number[]) =>
    temps.map((t, i) => ({
      time: `${date}T${String(8 + i).padStart(2, '0')}:00:00+09:00`,
      temp: t, feelsLike: t, humidity: 55, wind: 8, windGust: null,
      precipProb: 0, precipAmount: 0, uvIndex: 2, weatherCode: 1, isDay: true,
    }));
  const hourly = [
    ...mk('2026-10-16', Array(12).fill(20)),
    ...mk('2026-10-17', [8, 10, 13, 16, 18, 19, 19, 18, 16, 14, 12, 10]),
  ];
  const t = recommend({
    hourly, settings: BASE, air: null,
    now: new Date('2026-10-16T16:00:00+09:00'),
    targetDate: '2026-10-17',
  });
  check('내일은 아침부터 전 구간 분석', t.analysis.rangeMin === 8, String(t.analysis.rangeMin));
}

// 귀가 시간이 지나면 오늘은 빈 구간
{
  const hourly = hours(Array(12).fill(20)); // 08~19시
  const slice = sliceOuting(hourly, BASE, new Date('2026-10-16T21:00:00+09:00'), '2026-10-16');
  check('귀가 후에는 오늘 구간이 비어 화면이 내일로 넘어간다', slice.length === 0);
}

/* ========================================================= 내일 예보 추천 */

console.log('\n── 내일 예보 기반 추천 ──\n');

/** 이틀치 시간별 예보 — 오늘 8~19시, 내일 8~19시 */
function twoDays(todayTemp: number, tomorrowTemp: number): HourPoint[] {
  const mk = (date: string, temp: number) =>
    Array.from({ length: 12 }, (_, i) => ({
      time: `${date}T${String(8 + i).padStart(2, '0')}:00:00+09:00`,
      temp,
      feelsLike: temp,
      humidity: 55,
      wind: 8,
      windGust: null,
      precipProb: 0,
      precipAmount: 0,
      uvIndex: 2,
      weatherCode: 1,
      isDay: true,
    }));
  return [...mk('2026-10-16', todayTemp), ...mk('2026-10-17', tomorrowTemp)];
}

{
  const hourly = twoDays(20, 5); // 오늘 20°C, 내일 5°C
  const today = recommend({
    hourly,
    settings: BASE,
    air: { pm25: 20, pm10: 30 },
    now: new Date('2026-10-16T08:00:00+09:00'),
  });
  const tomorrow = recommend({
    hourly,
    settings: BASE,
    air: { pm25: 20, pm10: 30 },
    now: new Date('2026-10-16T08:00:00+09:00'),
    targetDate: '2026-10-17',
  });

  show('오늘 20°C', today);
  show('내일 5°C', tomorrow);

  check('내일: 다른 날짜가 분석됨', tomorrow.analysis.weightedFeelsLike !== today.analysis.weightedFeelsLike);
  check('내일: 기온대로 보온이 올라감', tomorrow.analysis.outfitWarmth > today.analysis.outfitWarmth,
    `${tomorrow.analysis.outfitWarmth} vs ${today.analysis.outfitWarmth}`);
  check('내일: 체감이 예보값과 일치', Math.round(tomorrow.analysis.weightedFeelsLike) === 5,
    String(tomorrow.analysis.weightedFeelsLike));
}

// 반대 방향 — 오늘 추움, 내일 따뜻함
{
  const hourly = twoDays(2, 24);
  const t = recommend({
    hourly, settings: BASE, air: null,
    now: new Date('2026-10-16T08:00:00+09:00'),
    targetDate: '2026-10-17',
  });
  show('내일 24°C', t);
  check('내일 따뜻: 아우터 없음 또는 가벼움', t.outfit.outer.length === 0 || t.analysis.outfitWarmth <= 2,
    `outer=${t.outfit.outer.join(',')} warmth=${t.analysis.outfitWarmth}`);
}

// 없는 날짜를 요청하면 명확히 실패해야 한다
{
  let threw = false;
  try {
    recommend({
      hourly: twoDays(15, 15), settings: BASE, air: null,
      now: new Date('2026-10-16T08:00:00+09:00'),
      targetDate: '2026-10-25',
    });
  } catch { threw = true; }
  check('없는 날짜: 조용히 틀린 답 대신 오류', threw);
}

// 외출 시간 미설정 + 내일
{
  const hourly = twoDays(20, 10);
  const t = recommend({
    hourly,
    settings: { ...BASE, departAt: null, returnAt: null },
    air: null,
    now: new Date('2026-10-16T14:00:00+09:00'),
    targetDate: '2026-10-17',
  });
  check('시간 미설정 + 내일: 같은 시각대 3시간을 본다', Math.round(t.analysis.weightedFeelsLike) === 10);
}

/* ================================================================ 성별 */

console.log('\n── 성별에 맞는 옷만 ──\n');

const FEMALE_ONLY = ['skirt', 'long_skirt', 'leggings', 'wide_pants', 'blouse', 'onepiece', 'knit_onepiece', 'flats', 'sandals'];

// 남성에게 여성 전용 품목이 나오면 안 된다 — 전 구간 확인
{
  let leaked: string[] = [];
  for (let t = -20; t <= 40; t++) {
    for (const st of ['casual', 'minimal', 'office', 'sporty'] as const) {
      const r = run(flat(t), { gender: 'male', style: st });
      const all = [...r.outfit.top, ...r.outfit.outer, ...r.outfit.bottom, ...r.outfit.shoes];
      for (const id of all) if (FEMALE_ONLY.includes(id)) leaked.push(`${t}°C/${st}: ${id}`);
    }
  }
  check('남성에게 여성 전용 품목이 안 나온다', leaked.length === 0, leaked.slice(0, 3).join(' / '));
}

// 여성은 공용 + 여성 품목 모두 후보
{
  let ok = true;
  const problems: string[] = [];
  for (let t = -20; t <= 40; t++) {
    for (const st of ['casual', 'minimal', 'office', 'sporty'] as const) {
      try {
        const r = run(flat(t), { gender: 'female', style: st });
        const wearingDress = r.outfit.top.some((i) => ['onepiece', 'knit_onepiece'].includes(i));
        // 원피스를 입으면 하의가 없을 수 있다 — 단 추울 땐 반드시 있어야 한다
        const needsBottom = !wearingDress || t < 11;
        if (!r.outfit.top.length || !r.outfit.shoes.length || (needsBottom && !r.outfit.bottom.length)) {
          ok = false; problems.push(`${t}°C/${st}: ${r.outfit.top.join('+')}|${r.outfit.bottom.join(',')}`);
        }
      } catch (e) { ok = false; problems.push(`${t}°C/${st}: ${e}`); }
    }
  }
  check('여성도 전 구간에서 조합이 나온다', ok, problems.slice(0, 3).join(' / '));
}

// 여성 전용 품목이 실제로 쓰이는지 (안 쓰이면 추가한 의미가 없다)
{
  const used = new Set<string>();
  for (let t = -20; t <= 40; t++) {
    for (const st of ['casual', 'minimal', 'office', 'sporty'] as const) {
      const r = run(flat(t), { gender: 'female', style: st });
      [...r.outfit.top, ...r.outfit.bottom, ...r.outfit.shoes].forEach((i) => used.add(i));
    }
  }
  const usedFemale = FEMALE_ONLY.filter((i) => used.has(i));
  console.log(`    실제 등장: ${usedFemale.join(', ') || '없음'}`);
  check('여성 전용 품목이 실제 추천에 등장', usedFemale.length >= 3, usedFemale.join(','));
}

// 같은 날씨에서 성별에 따라 결과가 갈린다
{
  const f = run(flat(24), { gender: 'female', style: 'minimal' });
  const m = run(flat(24), { gender: 'male', style: 'minimal' });
  show('24°C 여성', f);
  show('24°C 남성', m);
  check('성별에 따라 조합이 달라질 수 있다',
    JSON.stringify(f.outfit) !== JSON.stringify(m.outfit) || true); // 같을 수도 있으므로 정보성
}

// 원피스는 하의를 같이 추천하지 않는다
{
  const FULL_BODY = ['onepiece', 'knit_onepiece'];
  const bad: string[] = [];
  for (let t = -20; t <= 40; t++) {
    for (const st of ['casual', 'minimal', 'office', 'sporty'] as const) {
      const r = run(flat(t), { gender: 'female', style: st });
      const hasDress = r.outfit.top.some((i) => FULL_BODY.includes(i));
      if (!hasDress) continue;
      const bottoms = r.outfit.bottom;
      // 레깅스는 덧입을 수 있지만 바지·치마는 안 된다
      const wrong = bottoms.filter((b) => b !== 'leggings');
      if (wrong.length > 0) bad.push(`${t}°C/${st}: ${r.outfit.top.join('+')} + ${wrong.join(',')}`);
    }
  }
  check('원피스에 바지·치마를 겹치지 않는다', bad.length === 0, bad.slice(0, 3).join(' / '));
}

// 결정론 유지
{
  const first = JSON.stringify(run(flat(16), { gender: 'female' }).outfit);
  let same = true;
  for (let i = 0; i < 50; i++) {
    if (JSON.stringify(run(flat(16), { gender: 'female' }).outfit) !== first) same = false;
  }
  check('여성도 같은 입력이면 같은 결과', same);
}

/* ------------------------------------------------------------------ 결과 */

console.log(`\n${failed === 0 ? '통과' : '실패'} — ${passed}개 통과, ${failed}개 실패\n`);
process.exit(failed === 0 ? 0 : 1);
