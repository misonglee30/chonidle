import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { BottomBar } from '@/components/bottom-bar';
import { palette, SPACING } from '@/constants/weather-theme';
import { nameOf } from '@/lib/clothing';
import { imageOf } from '@/lib/clothing-images';
import { recommend, sliceOuting, type Recommendation } from '@/lib/recommend';
import { useSettings } from '@/lib/settings-context';
import { useWeather } from '@/lib/weather-context';
import { airForWindow, availableDates, describe } from '@/lib/weather';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type DayRec = {
  date: string;
  label: string;
  weekday: string;
  rec: Recommendation;
  min: number;
  max: number;
  code: number;
  isToday: boolean;
  /** 사흘 뒤부터는 예보 신뢰도가 떨어진다 */
  lowConfidence: boolean;
};

export default function ForecastScreen() {
  const { settings } = useSettings();
  const { data, error, loading, refreshing, reload } = useWeather();

  const days: DayRec[] = useMemo(() => {
    if (!data) return [];
    const dates = availableDates(data.hourly);
    const now = new Date();

    return dates.flatMap((date, i) => {
      const slice = sliceOuting(data.hourly, settings, now, date);
      if (slice.length === 0) return [];
      try {
        const rec = recommend({
          hourly: data.hourly,
          settings,
          air: i === 0 ? data.air : airForWindow(data.airHourly, slice),
          targetDate: date,
          now,
        });
        const feels = slice.map((h) => h.feelsLike ?? h.temp);
        const d = new Date(`${date}T12:00:00`);
        return [{
          date,
          label: i === 0 ? '오늘' : i === 1 ? '내일' : `${d.getMonth() + 1}/${d.getDate()}`,
          weekday: WEEKDAYS[d.getDay()],
          rec,
          min: Math.round(Math.min(...feels)),
          max: Math.round(Math.max(...feels)),
          code: slice[Math.floor(slice.length / 2)].weatherCode,
          isToday: i === 0,
          lowConfidence: i >= 3,
        }];
      } catch {
        return [];
      }
    });
  }, [data, settings]);

  // 막대 그래프 기준 — 전체 기간의 최저·최고
  const range = useMemo(() => {
    if (days.length === 0) return { min: 0, max: 1 };
    return {
      min: Math.min(...days.map((d) => d.min)),
      max: Math.max(...days.map((d) => d.max)),
    };
  }, [days]);

  const first = days[0];
  const p = useMemo(() => {
    const tone = describe(first?.code ?? 3).tone;
    return palette(tone, true);
  }, [first?.code]);

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={p.muted} />
          }>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: p.text }]}>주간 옷차림</Text>
            <MyButton p={p} />
          </View>
          <Text style={[styles.subtitle, { color: p.muted }]}>
            설정한 외출 시간대 기준이에요
          </Text>

          {error ? (
            <View style={styles.center}>
              <Text style={[styles.errorText, { color: p.text }]}>{error}</Text>
              <Pressable onPress={() => reload()} hitSlop={12}>
                <Text style={[styles.retry, { color: p.accent }]}>다시 시도</Text>
              </Pressable>
            </View>
          ) : loading || days.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={p.muted} />
            </View>
          ) : (
            days.map((d) => <DayCard key={d.date} day={d} range={range} p={p} />)
          )}
        </ScrollView>
        <BottomBar p={p} />
      </SafeAreaView>
    </View>
  );
}

type P = ReturnType<typeof palette>;

function MyButton({ p }: { p: P }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace('/my')}
      hitSlop={10}
      style={[styles.myBtn, { borderColor: p.line }]}>
      <Text style={[styles.myBtnText, { color: p.text }]}>MY</Text>
    </Pressable>
  );
}

function DayCard({
  day,
  range,
  p,
}: {
  day: DayRec;
  range: { min: number; max: number };
  p: P;
}) {
  const span = Math.max(range.max - range.min, 1);
  const leftF = day.min - range.min;
  const fillF = Math.max(day.max - day.min, span * 0.06);
  const rightF = Math.max(range.max - day.max, 0);

  const items = [
    ...day.rec.outfit.top,
    ...day.rec.outfit.outer,
    ...day.rec.outfit.bottom,
    ...day.rec.outfit.shoes,
  ];
  const condition = describe(day.code);

  return (
    <View
      style={[
        styles.card,
        { borderColor: p.line },
        day.isToday && { backgroundColor: p.wash, borderColor: 'transparent' },
      ]}>
      <View style={styles.cardHead}>
        <View style={styles.dayLabelWrap}>
          <Text style={[styles.dayLabel, { color: p.text }, day.isToday && styles.bold]}>
            {day.label}
          </Text>
          {!day.isToday && (
            <Text style={[styles.weekday, { color: p.muted }]}>{day.weekday}</Text>
          )}
        </View>

        <Text style={[styles.condition, { color: p.muted }]} numberOfLines={1}>
          {condition.label}
        </Text>

        <View style={styles.tempWrap}>
          <Text style={[styles.tempMin, { color: p.muted }]}>{day.min}°</Text>
          <View style={[styles.track, { backgroundColor: p.line }]}>
            <View style={{ flex: leftF }} />
            <View
              style={[
                styles.fill,
                { flex: fillF, backgroundColor: day.isToday ? p.accent : `${p.accent}66` },
              ]}
            />
            <View style={{ flex: rightF }} />
          </View>
          <Text style={[styles.tempMax, { color: p.text }]}>{day.max}°</Text>
        </View>
      </View>

      <Text style={[styles.headline, { color: p.text }]}>{day.rec.headline}</Text>

      <View style={styles.itemRow}>
        {items.map((id) => {
          const src = imageOf(id);
          return (
            <View key={id} style={styles.chip}>
              {src && <Image source={src} style={styles.chipImg} resizeMode="contain" />}
              <Text style={[styles.chipLabel, { color: p.muted }]} numberOfLines={1}>
                {nameOf(id)}
              </Text>
            </View>
          );
        })}
      </View>

      {day.rec.outfit.accessories.length > 0 && (
        <Text style={[styles.accessories, { color: p.muted }]}>
          챙길 것 · {day.rec.outfit.accessories.map(nameOf).join(' · ')}
        </Text>
      )}

      {day.lowConfidence && (
        <Text style={[styles.confidence, { color: p.muted }]}>
          사흘 뒤 예보라 바뀔 수 있어요
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32, paddingTop: 8 },
  bold: { fontWeight: '700' },
  center: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.gutter,
  },
  title: { fontSize: 26, fontWeight: '700' },
  myBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  myBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: SPACING.gutter,
    marginTop: 4,
    marginBottom: 18,
  },

  card: {
    marginHorizontal: SPACING.gutter,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayLabelWrap: { width: 52, flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  dayLabel: { fontSize: 15 },
  weekday: { fontSize: 12 },
  condition: { fontSize: 12, width: 64 },
  tempWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tempMin: { fontSize: 13, width: 30, textAlign: 'right' },
  tempMax: { fontSize: 13, width: 30, fontWeight: '500' },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  fill: { borderRadius: 2 },

  headline: { fontSize: 16, fontWeight: '600', marginTop: 14 },

  itemRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 8 },
  chip: { alignItems: 'center', width: 62, gap: 2 },
  chipImg: { width: 50, height: 50 },
  chipLabel: { fontSize: 10 },

  accessories: { fontSize: 12, marginTop: 8 },
  confidence: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },

  errorText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 40 },
  retry: { fontSize: 15, fontWeight: '600' },
});
