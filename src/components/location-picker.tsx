import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { requestCurrentLocation } from '@/lib/location';
import type { UserSettings } from '@/lib/settings';
import { CITIES } from '@/lib/weather';

const INK = '#0B0B0C';
const MUTED = '#8E8E93';
const LINE = '#E6E6E8';

/**
 * 현재 위치 + 지역 직접 선택.
 * 권한을 거부해도 아래 목록으로 계속 쓸 수 있어야 한다.
 */
export function LocationPicker({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const useGps = async () => {
    setBusy(true);
    setNotice(null);
    const r = await requestCurrentLocation();
    setBusy(false);

    if (r.ok) {
      onChange({
        locationMode: 'gps',
        gpsName: r.name,
        gpsLat: r.lat,
        gpsLon: r.lon,
      });
      setNotice(null);
    } else {
      // 거부해도 서비스는 계속된다 — 수동 선택으로 떨어뜨린다
      onChange({ locationMode: 'manual' });
      setNotice(r.message);
    }
  };

  const gpsActive = settings.locationMode === 'gps' && settings.gpsLat != null;

  return (
    <View>
      <Pressable
        onPress={useGps}
        disabled={busy}
        style={[styles.gpsBtn, gpsActive && styles.gpsBtnOn]}>
        <View style={styles.gpsTextWrap}>
          <Text style={[styles.gpsLabel, gpsActive && styles.bold]}>
            {gpsActive ? (settings.gpsName ?? '현재 위치') : '현재 위치 사용'}
          </Text>
          <Text style={styles.gpsHint}>
            {gpsActive ? '위치가 바뀌면 다시 눌러 갱신하세요' : '위치 권한을 한 번 요청해요'}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator color={MUTED} />
        ) : (
          <Text style={[styles.gpsMark, gpsActive && { color: INK }]}>
            {gpsActive ? '✓' : '›'}
          </Text>
        )}
      </Pressable>

      {notice && <Text style={styles.notice}>{notice}</Text>}

      <Text style={styles.divider}>또는 지역 직접 선택</Text>

      <View style={styles.cities}>
        {CITIES.map((c) => {
          const active = !gpsActive && settings.cityId === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                onChange({ locationMode: 'manual', cityId: c.id });
                setNotice(null);
              }}
              style={[styles.city, active && styles.cityOn]}>
              <Text style={[styles.cityText, active && styles.cityTextOn]}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  gpsBtnOn: { borderColor: INK, backgroundColor: '#FAFAFA' },
  gpsTextWrap: { flex: 1, gap: 2 },
  gpsLabel: { fontSize: 16, color: INK },
  gpsHint: { fontSize: 12, color: MUTED },
  gpsMark: { fontSize: 18, color: '#C9C9CE' },

  notice: {
    fontSize: 12,
    color: '#A8543F',
    marginTop: 10,
    lineHeight: 18,
  },

  divider: { fontSize: 12, color: MUTED, marginTop: 24, marginBottom: 10 },

  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  city: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cityOn: { borderColor: INK, backgroundColor: INK },
  cityText: { fontSize: 14, color: MUTED },
  cityTextOn: { color: '#FFFFFF', fontWeight: '600' },
});
