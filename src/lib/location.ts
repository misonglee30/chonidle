/**
 * 현재 위치 — 권한은 '앱 사용 중 허용'만 요청한다.
 *
 * 위치 권한은 서비스의 필수 가입 조건이 아니다. 거부해도 지역을 직접 고르면
 * 모든 기능이 그대로 동작해야 한다 (PRD 시나리오 D).
 */

import * as Location from 'expo-location';

export type Coords = { lat: number; lon: number };

export type LocationResult =
  | { ok: true; lat: number; lon: number; name: string }
  | { ok: false; reason: 'denied' | 'disabled' | 'failed'; message: string };

/** 좌표 → 한국식 지역명. 실패해도 좌표는 쓸 수 있으므로 이름만 비운다. */
async function nameOfCoords(coords: Coords): Promise<string> {
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lon,
    });
    const place = places[0];
    if (!place) return '현재 위치';

    // 한국 주소는 region(시·도) + city/district(시·군·구) 조합이 자연스럽다
    const parts = [place.region, place.city ?? place.district ?? place.subregion]
      .filter((v): v is string => !!v)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    return parts.length > 0 ? parts.join(' ') : '현재 위치';
  } catch {
    return '현재 위치';
  }
}

export async function requestCurrentLocation(): Promise<LocationResult> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      return {
        ok: false,
        reason: 'disabled',
        message: '기기의 위치 서비스가 꺼져 있어요. 설정에서 켜주세요.',
      };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: '위치 권한이 없어요. 지역을 직접 선택해도 괜찮아요.',
      };
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const name = await nameOfCoords({ lat, lon });

    return { ok: true, lat, lon, name };
  } catch {
    return {
      ok: false,
      reason: 'failed',
      message: '위치를 확인하지 못했어요. 지역을 직접 선택해 주세요.',
    };
  }
}

/** 권한을 이미 받았는지 — 물어보지 않고 확인만 한다 */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
