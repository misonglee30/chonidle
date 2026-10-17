import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useSettings } from '@/lib/settings-context';
import { CITIES, fetchWeather, type Spot, type WeatherData } from '@/lib/weather';

type Ctx = {
  /** 실제로 날씨를 조회한 지점 — GPS든 직접 선택이든 */
  city: Spot;
  data: WeatherData | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: (isRefresh?: boolean) => void;
};

const WeatherContext = createContext<Ctx | null>(null);

/**
 * 날씨를 한 번만 받아 오늘·예보 화면이 같이 쓴다.
 * 탭을 옮길 때마다 다시 부르면 호출만 늘고 두 화면의 숫자가 어긋날 수 있다.
 */
export function WeatherProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();

  /**
   * GPS 모드인데 좌표가 아직 없으면 직접 고른 지역으로 떨어진다.
   * 위치를 못 받았다고 화면이 비면 안 된다.
   */
  const city = useMemo<Spot>(() => {
    if (
      settings.locationMode === 'gps' &&
      settings.gpsLat != null &&
      settings.gpsLon != null
    ) {
      return {
        id: 'gps',
        name: settings.gpsName ?? '현재 위치',
        lat: settings.gpsLat,
        lon: settings.gpsLon,
      };
    }
    return CITIES.find((c) => c.id === settings.cityId) ?? CITIES[0];
  }, [settings.locationMode, settings.gpsLat, settings.gpsLon, settings.gpsName, settings.cityId]);

  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (target: Spot, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await fetchWeather(target));
      } catch (e) {
        setError(e instanceof Error ? e.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    setData(null);
    load(city);
    // 좌표가 같으면 다시 부르지 않는다 (객체 정체성은 매번 바뀌므로)
  }, [city.lat, city.lon, load]);

  const value = useMemo(
    () => ({
      city,
      data,
      error,
      loading,
      refreshing,
      reload: (isRefresh = false) => load(city, isRefresh),
    }),
    [city, data, error, loading, refreshing, load]
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): Ctx {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather는 WeatherProvider 안에서만 쓸 수 있습니다');
  return ctx;
}
