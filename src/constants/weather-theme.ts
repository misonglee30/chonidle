import type { WeatherTone } from '@/lib/weather';

/**
 * 베이스는 화이트/블랙 고정. 날씨에 따라 accent 하나만 바뀌고,
 * 그 색을 아주 옅게 깔아 전체 톤을 이동시킨다. 색 비중은 10% 내외.
 * 다크모드는 쓰지 않는다 (라이트 전용).
 */

export type Palette = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  /** 강조색을 옅게 깐 면 */
  wash: string;
};

const BASE = {
  bg: '#FFFFFF',
  surface: '#FAFAFB',
  text: '#0B0B0C',
  muted: '#8E8E93',
  line: '#ECECEE',
} as const;

type ToneKey = WeatherTone | 'clearNight';

const ACCENT: Record<ToneKey, string> = {
  clear: '#D98324',      // 맑은 낮 — 앰버
  clearNight: '#4C5BB3', // 맑은 밤 — 인디고
  partly: '#A8824A',     // 구름 조금
  cloud: '#71787F',      // 흐림 — 쿨 그레이
  fog: '#8F8880',        // 안개 — 웜 그레이
  drizzle: '#55748F',    // 이슬비
  rain: '#2F65A5',       // 비 — 블루
  snow: '#5E96B0',       // 눈 — 아이스 블루
  thunder: '#5B4A99',    // 뇌우 — 바이올렛
};

function alpha(hex: string, a: number) {
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

export function palette(tone: WeatherTone, isDay: boolean): Palette {
  const key: ToneKey = tone === 'clear' && !isDay ? 'clearNight' : tone;
  const accent = ACCENT[key];
  return { ...BASE, accent, wash: alpha(accent, 0.07) };
}

export const SPACING = { gutter: 20, gap: 14 } as const;
