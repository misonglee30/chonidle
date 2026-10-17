/**
 * 기상청 단기예보 연동.
 *
 * 왜 Open-Meteo를 두고 이걸 쓰는가: 인천 기준 비교에서 습도가 15%p 어긋났다.
 * 고습 판정선이 75%라 추천이 갈릴 수 있는 차이다. 한국은 기상청이 가장 정확하다.
 *
 * 한계 — 기상청이 주지 않는 값은 Open-Meteo로 메운다.
 *  · 체감온도: 직접 계산 (아래 feelsLike)
 *  · 자외선·대기질: 별도 API라 Open-Meteo 값을 쓴다
 *  · 4일 이후: 단기예보는 +3일까지만. 주간은 Open-Meteo가 담당한다
 */

import type { HourPoint } from '@/lib/recommend';
import { latestBaseTime, nowcastBaseTime, toGrid } from '@/lib/kma-grid';

const BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

/**
 * 웹에서 쓰는 중계 함수 주소 (netlify/functions/kma.mjs).
 *
 * 브라우저는 CORS 때문에 기상청을 직접 못 부른다. 그래서 같은 도메인의 이 주소로
 * 대신 요청하고, 서버가 인증키를 붙여 기상청에 다녀온다. 키가 브라우저에 안 실린다.
 */
const PROXY = '/api/kma';

/**
 * data.go.kr 인증키는 원본(Decoding)과 %로 감싼 것(Encoding) 두 가지로 발급된다.
 * 인코딩된 쪽을 그대로 쓰면 두 번 인코딩되어 인증이 깨지므로 한 번 풀어준다.
 */
export function normalizeKey(raw: string): string {
  const k = raw.trim();
  return k.includes('%') ? decodeURIComponent(k) : k;
}

/**
 * 중계 함수는 배포된 사이트에만 존재한다.
 * 로컬 개발 서버(localhost)에서는 없으므로 기상청 시도를 아예 건너뛴다 —
 * 매번 실패해서 "연결하지 못했어요" 안내가 뜨는 걸 막기 위한 것.
 */
export function kmaProxyAvailable(): boolean {
  // document은 브라우저에만 있다 — 앱(네이티브)에서는 여기서 바로 false
  if (typeof document === 'undefined') return false;
  const h = typeof window !== 'undefined' ? (window.location?.hostname ?? '') : '';
  return h !== '' && h !== 'localhost' && h !== '127.0.0.1';
}

type KmaItem = {
  category: string;
  fcstDate?: string;
  fcstTime?: string;
  fcstValue?: string;
  baseDate?: string;
  baseTime?: string;
  obsrValue?: string;
};

type KmaResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: KmaItem[] } };
  };
};

export class KmaError extends Error {
  constructor(
    message: string,
    /** 키 문제인지 일시적 문제인지 구분해 화면에서 다르게 안내한다 */
    readonly kind: 'auth' | 'quota' | 'network' | 'empty' | 'unknown'
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------- 체감온도 */

/**
 * 체감온도 — 기상청이 제공하지 않아 직접 계산한다.
 * 기온 10°C 이하·풍속 1.3m/s 이상에서는 바람으로 인한 체감(기상청 공식),
 * 더울 때는 습도를 반영한 열지수, 그 사이는 기온을 그대로 쓴다.
 */
export function feelsLike(tempC: number, windKmh: number, humidity: number): number {
  if (tempC <= 10 && windKmh >= 4.8) {
    const v = Math.pow(windKmh, 0.16);
    return (
      13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v
    );
  }

  if (tempC >= 27) {
    const t = tempC;
    const r = humidity;
    // 간이 열지수 (섭씨)
    const hi =
      -8.784695 +
      1.61139411 * t +
      2.338549 * r -
      0.14611605 * t * r -
      0.012308094 * t * t -
      0.016424828 * r * r +
      0.002211732 * t * t * r +
      0.00072546 * t * r * r -
      0.000003582 * t * t * r * r;
    return hi;
  }

  return tempC;
}

/* --------------------------------------------------- 하늘상태 → WMO 코드 */

/**
 * 기상청은 하늘상태(SKY)와 강수형태(PTY)를 따로 준다.
 * 앱 전체가 WMO 코드를 쓰고 있으므로 거기에 맞춰 변환한다.
 */
export function toWmoCode(sky: number, pty: number): number {
  // 강수형태가 있으면 그게 우선
  switch (pty) {
    case 1: return 63; // 비
    case 2: return 67; // 비/눈
    case 3: return 73; // 눈
    case 4: return 81; // 소나기
    case 5: return 51; // 빗방울
    case 6: return 56; // 빗방울눈날림
    case 7: return 71; // 눈날림
  }
  switch (sky) {
    case 1: return 0; // 맑음
    case 3: return 2; // 구름많음
    case 4: return 3; // 흐림
  }
  return 3;
}

/* ------------------------------------------------------------ 응답 파싱 */

function readItems(json: KmaResponse): KmaItem[] {
  const code = json.response?.header?.resultCode;
  const msg = json.response?.header?.resultMsg ?? '';

  if (code && code !== '00') {
    // 00 외에는 전부 오류. 키 문제와 그 외를 갈라 안내 문구를 다르게 한다
    if (code === '30' || code === '31' || /SERVICE_KEY|UNREGISTERED|EXPIRED/i.test(msg)) {
      throw new KmaError('기상청 API 키가 올바르지 않거나 만료됐어요', 'auth');
    }
    if (code === '22' || /LIMITED_NUMBER|TRAFFIC/i.test(msg)) {
      throw new KmaError('기상청 API 일일 호출 한도를 넘었어요', 'quota');
    }
    throw new KmaError(`기상청 응답 오류 (${code} ${msg})`, 'unknown');
  }

  const items = json.response?.body?.items?.item;
  if (!Array.isArray(items) || items.length === 0) {
    throw new KmaError('기상청에서 받은 예보가 비어 있어요', 'empty');
  }
  return items;
}

/** 'YYYYMMDD' + 'HHMM' → '2026-10-17T14:00:00+09:00' */
function toIso(date: string, time: string): string {
  const y = date.slice(0, 4);
  const m = date.slice(4, 6);
  const d = date.slice(6, 8);
  const hh = time.slice(0, 2);
  return `${y}-${m}-${d}T${hh}:00:00+09:00`;
}

export type KmaHour = {
  time: string;
  temp: number;
  humidity: number;
  /** km/h */
  wind: number;
  precipProb: number;
  /** mm/h */
  precipAmount: number;
  sky: number;
  pty: number;
};

/** 단기예보 응답 → 시간별 배열 */
export function parseForecast(json: KmaResponse): KmaHour[] {
  const items = readItems(json);
  const bucket = new Map<string, Partial<KmaHour> & { date: string; time: string }>();

  for (const it of items) {
    if (!it.fcstDate || !it.fcstTime) continue;
    const key = `${it.fcstDate}${it.fcstTime}`;
    const slot =
      bucket.get(key) ?? { date: it.fcstDate, time: it.fcstTime };
    const v = it.fcstValue ?? '';

    switch (it.category) {
      case 'TMP': slot.temp = Number(v); break;              // 기온 °C
      case 'REH': slot.humidity = Number(v); break;          // 습도 %
      case 'WSD': slot.wind = Number(v) * 3.6; break;        // 풍속 m/s → km/h
      case 'POP': slot.precipProb = Number(v); break;        // 강수확률 %
      case 'PCP': slot.precipAmount = parsePcp(v); break;    // 1시간 강수량
      case 'SKY': slot.sky = Number(v); break;
      case 'PTY': slot.pty = Number(v); break;
    }
    bucket.set(key, slot);
  }

  return [...bucket.values()]
    .filter((s) => s.temp != null)
    .map((s) => ({
      time: toIso(s.date, s.time),
      temp: s.temp!,
      humidity: s.humidity ?? 50,
      wind: s.wind ?? 0,
      precipProb: s.precipProb ?? 0,
      precipAmount: s.precipAmount ?? 0,
      sky: s.sky ?? 3,
      pty: s.pty ?? 0,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * 강수량은 숫자가 아니라 '강수없음' '1mm 미만' '30.0~50.0mm' 같은 문자열로 온다.
 * 그대로 Number()에 넣으면 전부 NaN이 되어 비 판정이 통째로 죽는다.
 */
export function parsePcp(v: string): number {
  if (!v || v.includes('강수없음') || v === '-') return 0;
  if (v.includes('미만')) return 0.5;
  const range = v.match(/([\d.]+)\s*~\s*([\d.]+)/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** 초단기실황 응답 → 현재값 */
export function parseNowcast(json: KmaResponse) {
  const items = readItems(json);
  const get = (cat: string) => {
    const hit = items.find((i) => i.category === cat);
    return hit?.obsrValue != null ? Number(hit.obsrValue) : null;
  };
  return {
    temp: get('T1H'),
    humidity: get('REH'),
    wind: get('WSD') != null ? get('WSD')! * 3.6 : null,
    pty: get('PTY') ?? 0,
    precipAmount: get('RN1') ?? 0,
  };
}

/* -------------------------------------------------------------- 호출부 */

/**
 * 웹은 중계 함수를 거치고, 앱은 기상청을 직접 부른다.
 * 호출하는 쪽은 이 차이를 몰라도 된다.
 */
function buildUrl(path: string, params: Record<string, string>, key: string): string {
  if (kmaProxyAvailable()) {
    // 인증키는 서버가 붙인다 — 여기서는 보내지 않는다
    return `${PROXY}?${new URLSearchParams({ path, ...params })}`;
  }
  return `${BASE}/${path}?${new URLSearchParams({
    serviceKey: normalizeKey(key),
    dataType: 'JSON',
    numOfRows: '1000',
    pageNo: '1',
    ...params,
  })}`;
}

async function callKma(path: string, params: Record<string, string>, key: string) {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params, key));
  } catch {
    throw new KmaError('기상청에 연결하지 못했어요', 'network');
  }

  const text = await res.text();

  if (!res.ok) {
    // 중계 함수가 돌려준 사유를 구분해 안내 문구를 다르게 한다
    if (text.includes('KMA_KEY_MISSING')) {
      throw new KmaError('서버에 기상청 인증키가 설정되지 않았어요', 'auth');
    }
    throw new KmaError(`기상청 응답 오류 (${res.status})`, 'network');
  }

  // 키가 잘못되면 JSON 대신 XML 에러가 오는 경우가 있다
  if (text.trim().startsWith('<')) {
    if (/SERVICE_KEY|SERVICE KEY/i.test(text)) {
      throw new KmaError('기상청 API 키가 올바르지 않아요', 'auth');
    }
    throw new KmaError('기상청이 예상치 못한 형식으로 응답했어요', 'unknown');
  }
  return JSON.parse(text) as KmaResponse;
}

export type KmaResult = {
  hourly: HourPoint[];
  current: { temp: number; feelsLike: number; humidity: number; wind: number; code: number } | null;
  updatedAt: string;
};

/**
 * 단기예보 + 초단기실황을 받아 앱 형식으로 돌려준다.
 * 자외선과 is_day는 기상청이 주지 않으므로 호출부가 Open-Meteo 값으로 채운다.
 */
export async function fetchKma(
  lat: number,
  lon: number,
  key: string,
  now: Date = new Date()
): Promise<KmaResult> {
  const { nx, ny } = toGrid(lat, lon);
  const fc = latestBaseTime(now);
  const nc = nowcastBaseTime(now);

  const [fcJson, ncJson] = await Promise.all([
    callKma('getVilageFcst', {
      base_date: fc.baseDate,
      base_time: fc.baseTime,
      nx: String(nx),
      ny: String(ny),
    }, key),
    callKma('getUltraSrtNcst', {
      base_date: nc.baseDate,
      base_time: nc.baseTime,
      nx: String(nx),
      ny: String(ny),
    }, key).catch(() => null), // 실황은 실패해도 예보로 대체한다
  ]);

  const rows = parseForecast(fcJson);

  const hourly: HourPoint[] = rows.map((r) => ({
    time: r.time,
    temp: r.temp,
    feelsLike: Math.round(feelsLike(r.temp, r.wind, r.humidity) * 10) / 10,
    humidity: r.humidity,
    wind: Math.round(r.wind * 10) / 10,
    windGust: null,
    precipProb: r.precipProb,
    precipAmount: r.precipAmount,
    uvIndex: null, // Open-Meteo로 채운다
    weatherCode: toWmoCode(r.sky, r.pty),
    isDay: true, // Open-Meteo로 채운다
  }));

  let current: KmaResult['current'] = null;
  if (ncJson) {
    try {
      const n = parseNowcast(ncJson);
      if (n.temp != null) {
        const h = n.humidity ?? 50;
        const w = n.wind ?? 0;
        current = {
          temp: Math.round(n.temp),
          feelsLike: Math.round(feelsLike(n.temp, w, h)),
          humidity: Math.round(h),
          wind: Math.round(w),
          code: toWmoCode(1, n.pty),
        };
      }
    } catch {
      current = null;
    }
  }

  return { hourly, current, updatedAt: toIso(fc.baseDate, fc.baseTime) };
}
