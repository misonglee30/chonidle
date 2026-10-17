/**
 * Open-Meteo 날씨 + 대기질 (둘 다 API 키 불필요)
 * - 예보:   https://api.open-meteo.com/v1/forecast
 * - 대기질: https://air-quality-api.open-meteo.com/v1/air-quality
 *
 * 대기질만 실패해도 예보는 그대로 쓴다. 마스크 한 줄 때문에 전체가 실패하면 안 된다.
 */

import type { AirQuality, HourPoint } from '@/lib/recommend';
import { fetchKma, KmaError, kmaProxyAvailable } from '@/lib/kma';

/**
 * 기상청 API 키 — 앱(네이티브)에서만 쓴다.
 * .env 파일에 EXPO_PUBLIC_KMA_KEY=... 로 넣으면 잡힌다.
 *
 * 웹에서는 이 값이 비어 있는 게 정상이다. 브라우저에 키를 심지 않고,
 * 배포된 사이트의 중계 함수(/api/kma)가 서버에서 키를 붙여 준다.
 * 어느 쪽도 없으면 Open-Meteo만 쓴다 — 키 없이도 앱은 그대로 동작해야 한다.
 */
const KMA_KEY = process.env.EXPO_PUBLIC_KMA_KEY ?? '';

export type City = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

/** 좌표만 있으면 되므로 GPS 결과도 그대로 넣을 수 있다 */
export type Spot = { id: string; name: string; lat: number; lon: number };

export const CITIES: City[] = [
  { id: 'seoul', name: '서울', lat: 37.5665, lon: 126.978 },
  { id: 'incheon', name: '인천', lat: 37.4563, lon: 126.7052 },
  { id: 'daejeon', name: '대전', lat: 36.3504, lon: 127.3845 },
  { id: 'daegu', name: '대구', lat: 35.8714, lon: 128.6014 },
  { id: 'gwangju', name: '광주', lat: 35.1595, lon: 126.8526 },
  { id: 'busan', name: '부산', lat: 35.1796, lon: 129.0756 },
  { id: 'jeju', name: '제주', lat: 33.4996, lon: 126.5312 },
];

/** WMO 날씨 코드 → 한글 + 톤 그룹 */
export type WeatherTone =
  | 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';

const WMO: Record<number, { label: string; tone: WeatherTone }> = {
  0: { label: '맑음', tone: 'clear' },
  1: { label: '대체로 맑음', tone: 'partly' },
  2: { label: '구름 조금', tone: 'partly' },
  3: { label: '흐림', tone: 'cloud' },
  45: { label: '안개', tone: 'fog' },
  48: { label: '서리 안개', tone: 'fog' },
  51: { label: '약한 이슬비', tone: 'drizzle' },
  53: { label: '이슬비', tone: 'drizzle' },
  55: { label: '강한 이슬비', tone: 'drizzle' },
  56: { label: '어는 이슬비', tone: 'drizzle' },
  57: { label: '강한 어는 이슬비', tone: 'drizzle' },
  61: { label: '약한 비', tone: 'rain' },
  63: { label: '비', tone: 'rain' },
  65: { label: '강한 비', tone: 'rain' },
  66: { label: '어는 비', tone: 'rain' },
  67: { label: '강한 어는 비', tone: 'rain' },
  71: { label: '약한 눈', tone: 'snow' },
  73: { label: '눈', tone: 'snow' },
  75: { label: '많은 눈', tone: 'snow' },
  77: { label: '싸락눈', tone: 'snow' },
  80: { label: '소나기', tone: 'rain' },
  81: { label: '소나기', tone: 'rain' },
  82: { label: '강한 소나기', tone: 'rain' },
  85: { label: '눈 소나기', tone: 'snow' },
  86: { label: '강한 눈 소나기', tone: 'snow' },
  95: { label: '뇌우', tone: 'thunder' },
  96: { label: '우박 뇌우', tone: 'thunder' },
  99: { label: '강한 우박 뇌우', tone: 'thunder' },
};

export function describe(code: number) {
  return WMO[code] ?? { label: '정보 없음', tone: 'cloud' as WeatherTone };
}

export type Current = {
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
};

export type AirPoint = { time: string; pm25: number | null; pm10: number | null };

/** 어느 소스를 실제로 썼는지 — 화면에 표시해 혼란을 막는다 */
export type WeatherSource = 'kma' | 'open-meteo';

export type WeatherData = {
  source: WeatherSource;
  /** 기상청을 쓰려 했으나 실패한 이유 (있으면 화면에 한 줄로 알린다) */
  sourceNote: string | null;
  current: Current;
  hourly: HourPoint[];
  /** 현재 대기질 */
  air: AirQuality | null;
  /** 시간별 대기질 — 내일 추천에 쓴다 */
  airHourly: AirPoint[];
  /** 데이터 생성 시각 */
  updatedAt: string;
};

/** 예보에 들어 있는 날짜 목록 (오늘, 내일 …) */
export function availableDates(hourly: HourPoint[]): string[] {
  const seen: string[] = [];
  for (const h of hourly) {
    const d = h.time.slice(0, 10);
    if (!seen.includes(d)) seen.push(d);
  }
  return seen;
}

/**
 * 외출 구간에 해당하는 대기질 — 가장 나쁜 값을 쓴다.
 * 하루 중 한때라도 나쁘면 마스크를 챙기는 게 맞다.
 */
export function airForWindow(
  airHourly: AirPoint[],
  slice: { time: string }[]
): AirQuality | null {
  if (slice.length === 0) return null;
  const times = new Set(slice.map((h) => h.time.slice(0, 13)));
  const hit = airHourly.filter((a) => times.has(a.time.slice(0, 13)));
  if (hit.length === 0) return null;

  const pm25 = hit.map((a) => a.pm25).filter((v): v is number => v != null);
  const pm10 = hit.map((a) => a.pm10).filter((v): v is number => v != null);
  if (pm25.length === 0 && pm10.length === 0) return null;

  return {
    pm25: pm25.length ? Math.max(...pm25) : null,
    pm10: pm10.length ? Math.max(...pm10) : null,
  };
}

type ForecastResponse = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    apparent_temperature: (number | null)[];
    relative_humidity_2m: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
    uv_index: (number | null)[];
    weather_code: (number | null)[];
    is_day: (number | null)[];
  };
};

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export async function fetchWeather(city: Spot): Promise<WeatherData> {
  const common = {
    latitude: String(city.lat),
    longitude: String(city.lon),
    timezone: 'Asia/Seoul',
  };

  const forecastParams = new URLSearchParams({
    ...common,
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation_probability',
      'precipitation',
      'uv_index',
      'weather_code',
      'is_day',
    ].join(','),
    forecast_days: '7',
  });

  const airParams = new URLSearchParams({
    ...common,
    current: 'pm2_5,pm10',
    hourly: 'pm2_5,pm10',
    forecast_days: '5',
  });

  // 대기질은 실패해도 무시한다
  const [forecastRes, airRes] = await Promise.all([
    fetch(`${FORECAST_URL}?${forecastParams}`),
    fetch(`${AIR_URL}?${airParams}`).catch(() => null),
  ]);

  if (!forecastRes.ok) {
    throw new Error(`날씨 정보를 불러오지 못했습니다 (${forecastRes.status})`);
  }
  const data: ForecastResponse = await forecastRes.json();

  let air: AirQuality | null = null;
  let airHourly: AirPoint[] = [];
  if (airRes && airRes.ok) {
    try {
      const a = await airRes.json();
      air = {
        pm25: a?.current?.pm2_5 ?? null,
        pm10: a?.current?.pm10 ?? null,
      };
      const at: string[] = a?.hourly?.time ?? [];
      airHourly = at.map((t, i) => ({
        time: t,
        pm25: a?.hourly?.pm2_5?.[i] ?? null,
        pm10: a?.hourly?.pm10?.[i] ?? null,
      }));
    } catch {
      air = null;
      airHourly = [];
    }
  }

  const h = data.hourly;
  const hourly: HourPoint[] = h.time.map((t, i) => ({
    time: t,
    temp: h.temperature_2m[i] ?? 0,
    feelsLike: h.apparent_temperature[i] ?? null,
    humidity: h.relative_humidity_2m[i] ?? 0,
    wind: h.wind_speed_10m[i] ?? 0,
    windGust: h.wind_gusts_10m[i] ?? null,
    precipProb: h.precipitation_probability[i] ?? 0,
    precipAmount: h.precipitation[i] ?? 0,
    uvIndex: h.uv_index[i] ?? null,
    weatherCode: h.weather_code[i] ?? 3,
    isDay: (h.is_day[i] ?? 1) === 1,
  }));

  const base = {
    current: {
      temp: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      humidity: Math.round(data.current.relative_humidity_2m),
      wind: Math.round(data.current.wind_speed_10m),
      code: data.current.weather_code,
      isDay: data.current.is_day === 1,
    },
    hourly,
    air,
    airHourly,
    updatedAt: data.current.time,
  };

  if (!KMA_KEY && !kmaProxyAvailable()) {
    return { source: 'open-meteo' as const, sourceNote: null, ...base };
  }

  // 기상청이 실패해도 Open-Meteo 결과로 계속 간다. 날씨가 아예 안 뜨는 게 최악이다.
  try {
    const kma = await fetchKma(city.lat, city.lon, KMA_KEY);
    return {
      source: 'kma' as const,
      sourceNote: null,
      ...base,
      // 기상청 실황에는 주야 구분이 없어 Open-Meteo 값을 가져온다
      current: kma.current ? { ...kma.current, isDay: base.current.isDay } : base.current,
      hourly: mergeHourly(base.hourly, kma.hourly),
      updatedAt: kma.updatedAt,
    };
  } catch (e) {
    const note =
      e instanceof KmaError
        ? e.kind === 'auth'
          ? '기상청 키에 문제가 있어 다른 예보로 표시 중이에요'
          : e.kind === 'quota'
            ? '기상청 호출 한도를 넘어 다른 예보로 표시 중이에요'
            : '기상청에 연결하지 못해 다른 예보로 표시 중이에요'
        : '기상청에 연결하지 못해 다른 예보로 표시 중이에요';
    return { source: 'open-meteo' as const, sourceNote: note, ...base };
  }
}

/**
 * 기상청 값으로 덮어쓰되, 기상청이 주지 않는 자외선·주야 구분은 Open-Meteo 값을 남긴다.
 * 기상청은 +3일까지만 주므로 그 뒤 시간은 Open-Meteo가 그대로 담당한다.
 */
export function mergeHourly(openMeteo: HourPoint[], kma: HourPoint[]): HourPoint[] {
  if (kma.length === 0) return openMeteo;
  const byTime = new Map(kma.map((h) => [h.time.slice(0, 13), h]));

  return openMeteo.map((om) => {
    const k = byTime.get(om.time.slice(0, 13));
    if (!k) return om;
    return {
      ...k,
      uvIndex: om.uvIndex,
      isDay: om.isDay,
      windGust: om.windGust,
    };
  });
}
