/**
 * 사용자 설정 — 기기 내부에만 저장한다. 서버 전송 없음, 회원가입 없음.
 *
 * 저장소는 AsyncStorage. 설치 안 되어 있으면 메모리로만 동작하므로
 * 앱을 껐다 켜면 온보딩이 다시 뜬다 (개발 중에는 오히려 편하다).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** 추위·더위 민감도 5단계 */
export type ProfileType = 'very_cold' | 'cold' | 'normal' | 'hot' | 'very_hot';

/** 바람·습도 민감도 3단계 */
export type EnvSensitivity = 'low' | 'normal' | 'high';

export type Style = 'casual' | 'minimal' | 'office' | 'sporty';
export type Activity = 'indoor' | 'mixed' | 'outdoor';

export type Gender = 'female' | 'male';

export type UserSettings = {
  gender: Gender;
  profileType: ProfileType;
  envSensitivity: EnvSensitivity;
  activity: Activity;
  /** 'HH:MM' — 미설정이면 null, 현재부터 3시간을 본다 */
  departAt: string | null;
  returnAt: string | null;
  style: Style;
  /** 'gps' = 현재 위치, 'manual' = 아래 cityId */
  locationMode: 'gps' | 'manual';
  /** 직접 고른 지역 id (lib/weather의 CITIES) — GPS 실패 시 폴백으로도 쓴다 */
  cityId: string;
  /** 마지막으로 확인된 현재 위치 */
  gpsName: string | null;
  gpsLat: number | null;
  gpsLon: number | null;
  /** 온보딩을 마쳤는지 */
  onboarded: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  gender: 'female',
  profileType: 'normal',
  envSensitivity: 'normal',
  activity: 'mixed',
  departAt: '08:00',
  returnAt: '19:00',
  style: 'casual',
  locationMode: 'manual',
  cityId: 'seoul',
  gpsName: null,
  gpsLat: null,
  gpsLon: null,
  onboarded: false,
};

const KEY = 'chonidle.settings.v1';

export async function loadSettings(): Promise<UserSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // 저장된 값에 없는 필드는 기본값으로 채운다 (버전이 올라가도 안 깨지게)
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: UserSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 저장 실패해도 앱은 계속 동작한다
  }
}

export async function clearSettings(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
