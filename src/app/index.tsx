import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BottomBar } from '@/components/bottom-bar';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { TimeRangeSlider } from '@/components/time-range-slider';
import { STYLE_OPTIONS } from '@/lib/options';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';

import { palette, SPACING } from '@/constants/weather-theme';
import { nameOf } from '@/lib/clothing';
import { imageOf } from '@/lib/clothing-images';
import { recommend, sliceOuting } from '@/lib/recommend';
import {
  loadFeedback,
  saveFeedback,
  VERDICT_LABEL,
  type FeedbackRecord,
  type Verdict,
} from '@/lib/feedback';
import { useSettings } from '@/lib/settings-context';
import { useWeather } from '@/lib/weather-context';
import { requestCurrentLocation } from '@/lib/location';
import { airForWindow, availableDates, CITIES, describe } from '@/lib/weather';

export default function TodayScreen() {
  const { settings, update } = useSettings();
  const { data, error, refreshing, reload } = useWeather();
  /** 0 = 오늘, 1 = 내일 */
  const [dayOffset, setDayOffset] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);

  const refreshFeedback = useCallback(() => {
    loadFeedback().then(setFeedback);
  }, []);
  useEffect(refreshFeedback, [refreshFeedback]);
  useFocusEffect(refreshFeedback);

  const dates = useMemo(() => (data ? availableDates(data.hourly) : []), [data]);

  /** 오늘 외출 시간이 이미 끝났으면 내일을 기본으로 띄운다 */
  const todayOver = useMemo(() => {
    if (!data || dates.length < 2) return false;
    return sliceOuting(data.hourly, settings, new Date(), dates[0]).length === 0;
  }, [data, dates, settings]);

  useEffect(() => {
    if (todayOver && dayOffset === 0) setDayOffset(1);
  }, [todayOver, dayOffset]);

  const targetDate = dates[dayOffset] ?? dates[0];
  const isToday = dayOffset === 0;

  /** 분석 대상 시간대 — 지표도 이 구간을 기준으로 보여준다 */
  const slice = useMemo(() => {
    if (!data || !targetDate) return [];
    return sliceOuting(data.hourly, settings, new Date(), targetDate);
  }, [data, settings, targetDate]);

  const airShown = useMemo(() => {
    if (!data) return null;
    return isToday ? data.air : airForWindow(data.airHourly, slice);
  }, [data, isToday, slice]);

  const rec = useMemo(() => {
    if (!data || slice.length === 0) return null;
    try {
      return recommend({
        hourly: data.hourly,
        settings,
        air: airShown,
        targetDate,
      });
    } catch {
      return null;
    }
  }, [data, settings, targetDate, airShown, slice]);

  /** 오늘은 현재 날씨, 내일은 외출 구간 한가운데 예보를 대표값으로 */
  const shown = useMemo(() => {
    if (!data) return null;
    if (isToday) return data.current;
    if (slice.length === 0) return data.current;
    const mid = slice[Math.floor(slice.length / 2)];
    return {
      temp: Math.round(mid.temp),
      feelsLike: Math.round(mid.feelsLike ?? mid.temp),
      humidity: Math.round(mid.humidity),
      wind: Math.round(mid.wind),
      code: mid.weatherCode,
      isDay: mid.isDay,
    };
  }, [data, isToday, slice]);

  const condition = describe(shown?.code ?? 3);
  const p = useMemo(
    () => palette(condition.tone, shown?.isDay ?? true),
    [condition.tone, shown?.isDay]
  );

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => reload(true)}
              tintColor={p.muted}
            />
          }>
          <CityBar p={p} />
          <View style={styles.topRow}>
            {data && dates.length > 1 ? (
              <DayTabs value={dayOffset} onChange={setDayOffset} p={p} />
            ) : (
              <View />
            )}
            <MyButton p={p} />
          </View>

          {error ? (
            <ErrorBlock message={error} onRetry={() => reload()} p={p} />
          ) : !data || !rec ? (
            <View style={styles.center}>
              <ActivityIndicator color={p.muted} />
            </View>
          ) : (
            <>
              {isToday && todayOver && (
                <Text style={[styles.meta, { color: p.muted }]}>
                  오늘 외출 시간이 끝나서 내일 기준으로 보여드려요
                </Text>
              )}
              <Meta date={targetDate} updatedAt={data.updatedAt} isToday={isToday} p={p} />
              {/* 조절 영역 — 외출 시간과 스타일 */}
              <View style={styles.controls}>
                <TimeRangeSlider
                  departAt={settings.departAt}
                  returnAt={settings.returnAt}
                  onChange={(d, r) => update({ departAt: d, returnAt: r })}
                />
                <View style={styles.controlGap}>
                  <SegmentedTabs
                    options={STYLE_OPTIONS}
                    value={settings.style}
                    onChange={(v) => update({ style: v })}
                  />
                </View>
              </View>

              <Hero rec={rec} isToday={isToday} p={p} />
              <Reasons rec={rec} p={p} />

              {/* 판단 근거 — 추천을 보고 난 뒤 확인하는 정보 */}
              <Stats current={shown ?? data.current} air={airShown} p={p} />
              <Timeline slice={slice} settings={settings} isToday={isToday} p={p} />

              {isToday && (
                <FeedbackBlock
                  date={targetDate}
                  rec={rec}
                  settings={settings}
                  records={feedback}
                  onSaved={setFeedback}
                  p={p}
                />
              )}
              <Footer rec={rec} data={data} p={p} />
            </>
          )}
        </ScrollView>
        <BottomBar p={p} />
      </SafeAreaView>
    </View>
  );
}

type P = ReturnType<typeof palette>;
type Rec = NonNullable<ReturnType<typeof recommend>>;

/* ------------------------------------------------------------- 도시 / 메타 */

function CityBar({ p }: { p: P }) {
  const { settings, update } = useSettings();
  const [locating, setLocating] = useState(false);
  const hasCoords = settings.gpsLat != null && settings.gpsLon != null;
  const gpsActive = settings.locationMode === 'gps' && hasCoords;

  /**
   * 현재위치 칩은 항상 보인다.
   * 다른 도시를 골랐다고 칩이 사라지면 GPS로 돌아올 길이 없어진다.
   */
  const onGps = async () => {
    if (hasCoords) {
      update({ locationMode: 'gps' });
      return;
    }
    setLocating(true);
    const r = await requestCurrentLocation();
    setLocating(false);
    if (r.ok) {
      update({ locationMode: 'gps', gpsName: r.name, gpsLat: r.lat, gpsLon: r.lon });
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cityBar}>
      <Pressable onPress={onGps} hitSlop={8} disabled={locating}>
        <Text
          style={[
            styles.cityName,
            { color: gpsActive ? p.text : p.muted },
            gpsActive && styles.bold,
          ]}>
          {locating ? '위치 확인 중…' : (hasCoords ? (settings.gpsName ?? '현재 위치') : '현재 위치')}
        </Text>
      </Pressable>

      {CITIES.map((c) => {
        const active = !gpsActive && c.id === settings.cityId;
        return (
          <Pressable
            key={c.id}
            onPress={() => update({ locationMode: 'manual', cityId: c.id })}
            hitSlop={8}>
            <Text
              style={[
                styles.cityName,
                { color: active ? p.text : p.muted },
                active && styles.bold,
              ]}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

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

function DayTabs({
  value,
  onChange,
  p,
}: {
  value: number;
  onChange: (v: number) => void;
  p: P;
}) {
  return (
    <View style={[styles.dayTabs, { borderColor: p.line }]}>
      {['오늘', '내일'].map((label, i) => {
        const active = i === value;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(i)}
            style={[styles.dayTab, active && { backgroundColor: p.accent }]}>
            <Text
              style={[
                styles.dayTabText,
                { color: active ? '#FFFFFF' : p.muted },
                active && styles.bold,
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Meta({
  date,
  updatedAt,
  isToday,
  p,
}: {
  date: string;
  updatedAt: string;
  isToday: boolean;
  p: P;
}) {
  const d = new Date(`${date}T12:00:00`);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const label = `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
  const time = updatedAt.slice(11, 16);
  return (
    <Text style={[styles.meta, { color: p.muted }]}>
      {label} · {isToday ? `날씨 기준 ${time}` : `${time} 발표 예보`}
    </Text>
  );
}

/* ------------------------------------------------------------------ 히어로 */

function Hero({ rec, isToday, p }: { rec: Rec; isToday: boolean; p: P }) {
  const items = [
    ...rec.outfit.top,
    ...rec.outfit.outer,
    ...rec.outfit.bottom,
    ...rec.outfit.shoes,
  ];

  return (
    <View style={[styles.hero, { backgroundColor: p.wash }]}>
      <View style={styles.kickerRow}>
        <Text style={[styles.kicker, { color: p.accent }]}>
          {isToday ? '오늘의 옷차림' : '내일의 옷차림'}
        </Text>
        {!isToday && (
          <View style={[styles.badge, { borderColor: p.accent }]}>
            <Text style={[styles.badgeText, { color: p.accent }]}>예상</Text>
          </View>
        )}
      </View>
      <Text style={[styles.headline, { color: p.text }]}>{rec.headline}</Text>

      <View style={styles.itemRow}>
        {items.map((id) => (
          <ItemChip key={id} id={id} p={p} size={76} />
        ))}
      </View>

      {rec.outfit.accessories.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: p.line }]} />
          <Text style={[styles.subLabel, { color: p.muted }]}>챙길 것</Text>
          <View style={styles.itemRow}>
            {rec.outfit.accessories.map((id) => (
              <ItemChip key={id} id={id} p={p} size={54} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function ItemChip({ id, p, size }: { id: string; p: P; size: number }) {
  const src = imageOf(id);
  return (
    <View style={[styles.chip, { width: size + 16 }]}>
      {src ? (
        <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <View
          style={[
            styles.chipFallback,
            { width: size, height: size, borderColor: p.line },
          ]}>
          <Text style={[styles.chipFallbackText, { color: p.muted }]}>이미지{'\n'}준비중</Text>
        </View>
      )}
      <Text style={[styles.chipLabel, { color: p.text }]} numberOfLines={1}>
        {nameOf(id)}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------- 이유 */

function Reasons({ rec, p }: { rec: Rec; p: P }) {
  // 최대 두 줄 — 더 늘리면 추천보다 설명이 길어진다
  const shown = rec.reasons.slice(0, 2);
  if (shown.length === 0) return null;

  return (
    <View style={styles.reasons}>
      {shown.map((r, i) => (
        <View key={i} style={styles.reasonRow}>
          <View style={[styles.dot, { backgroundColor: p.accent }]} />
          <Text style={[styles.reasonText, { color: p.muted }]} numberOfLines={1}>
            {r}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------- 지표 */

function Stats({
  current,
  air,
  p,
}: {
  current: { temp: number; feelsLike: number; humidity: number; wind: number };
  air: { pm25: number | null } | null;
  p: P;
}) {
  const c = current;
  const pm25 = air?.pm25;
  const items: { label: string; value: string }[] = [
    { label: '기온', value: `${c.temp}°` },
    { label: '체감', value: `${c.feelsLike}°` },
    { label: '습도', value: `${c.humidity}%` },
    { label: '바람', value: `${c.wind}` },
  ];
  if (pm25 != null) {
    items.push({ label: '초미세먼지', value: `${Math.round(pm25)}` });
  }

  return (
    <View style={[styles.stats, { borderColor: p.line }]}>
      {items.map((it, i) => (
        <View
          key={it.label}
          style={[
            styles.statCell,
            i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: p.line },
          ]}>
          <Text style={[styles.statValue, { color: p.text }]}>{it.value}</Text>
          <Text style={[styles.statLabel, { color: p.muted }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* --------------------------------------------------------------- 시간대별 */

function Timeline({
  slice,
  settings,
  isToday,
  p,
}: {
  slice: { time: string; temp: number; feelsLike: number | null }[];
  settings: ReturnType<typeof useSettings>['settings'];
  isToday: boolean;
  p: P;
}) {
  if (slice.length === 0) return null;

  const temps = slice.map((h) => Math.round(h.feelsLike ?? h.temp));
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(hi - lo, 1);
  const nowHour = new Date().getHours();

  return (
    <View style={styles.section}>
      <SectionTitle text={isToday ? '남은 시간 체감' : '시간대별 체감'} p={p} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hourScroll}>
        {slice.map((h, i) => {
          const t = temps[i];
          const hour = Number(h.time.slice(11, 13));
          const isNow = isToday && hour === nowHour;
          return (
            <View key={h.time} style={styles.hourCell}>
              <Text style={[styles.hourTemp, { color: isNow ? p.text : p.muted }, isNow && styles.bold]}>
                {t}°
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: 6 + ((t - lo) / span) * 34,
                      backgroundColor: isNow ? p.accent : `${p.accent}59`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.hourLabel, { color: isNow ? p.text : p.muted }, isNow && styles.bold]}>
                {isNow ? '지금' : `${hour}시`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------- 체감 피드백 */

const VERDICTS: Verdict[] = ['cold', 'good', 'hot'];

function FeedbackBlock({
  date,
  rec,
  settings,
  records,
  onSaved,
  p,
}: {
  date: string;
  rec: Rec;
  settings: ReturnType<typeof useSettings>['settings'];
  records: FeedbackRecord[];
  onSaved: (r: FeedbackRecord[]) => void;
  p: P;
}) {
  const mine = records.find((r) => r.date === date);

  const submit = (verdict: Verdict) => {
    saveFeedback({
      date,
      verdict,
      submittedAt: new Date().toISOString(),
      adjustedFeelsLike: rec.analysis.adjustedFeelsLike,
      outfitWarmth: rec.analysis.outfitWarmth,
      profileType: settings.profileType,
      outfit: [
        ...rec.outfit.top,
        ...rec.outfit.outer,
        ...rec.outfit.bottom,
        ...rec.outfit.shoes,
      ],
    }).then(onSaved);
  };

  return (
    <View style={styles.section}>
      <SectionTitle text="오늘 추천 어땠나요?" p={p} />
      <View style={styles.verdictRow}>
        {VERDICTS.map((v) => {
          const active = mine?.verdict === v;
          return (
            <Pressable
              key={v}
              onPress={() => submit(v)}
              style={[
                styles.verdict,
                { borderColor: active ? p.accent : p.line },
                active && { backgroundColor: p.wash },
              ]}>
              <Text
                style={[
                  styles.verdictText,
                  { color: active ? p.accent : p.muted },
                  active && styles.bold,
                ]}>
                {VERDICT_LABEL[v]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {mine && (
        <Text style={[styles.verdictNote, { color: p.muted }]}>
          기록했어요. 같은 답이 쌓이면 MY에서 성향 조정을 제안해드려요.
        </Text>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ 푸터 */

function Footer({ rec, data, p }: { rec: Rec; data: { source: string; sourceNote: string | null }; p: P }) {
  const quality =
    rec.dataQuality === 'full'
      ? null
      : rec.dataQuality === 'partial'
        ? '일부 날씨 정보가 없어 간소화해 추천했어요'
        : '저장된 정보로 표시 중이에요';

  const sourceLabel = data.source === 'kma' ? '기상청 단기예보' : 'Open-Meteo';

  return (
    <View style={styles.footer}>
      {data.sourceNote && (
        <Text style={[styles.footerText, { color: p.accent }]}>{data.sourceNote}</Text>
      )}
      {quality && <Text style={[styles.footerText, { color: p.muted }]}>{quality}</Text>}
      <Text style={[styles.footerText, { color: p.muted }]}>출처 {sourceLabel}</Text>
      <Text style={[styles.footerText, { color: p.muted }]}>
        분석 체감 {rec.analysis.adjustedFeelsLike}° · 외출 구간 {rec.analysis.rangeMin}°~
        {rec.analysis.rangeMax}° · 보온 {rec.analysis.outfitWarmth}/{rec.analysis.targetWarmth}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ 공통 */

function SectionTitle({ text, p }: { text: string; p: P }) {
  return <Text style={[styles.sectionTitle, { color: p.muted }]}>{text}</Text>;
}

function ErrorBlock({ message, onRetry, p }: { message: string; onRetry: () => void; p: P }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.errorText, { color: p.text }]}>{message}</Text>
      <Pressable onPress={onRetry} hitSlop={12}>
        <Text style={[styles.retry, { color: p.accent }]}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

/* ----------------------------------------------------------------- 스타일 */

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 40 },
  center: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bold: { fontWeight: '700' },

  cityBar: { paddingHorizontal: SPACING.gutter, paddingTop: 6, paddingBottom: 10, gap: 16 },
  cityName: { fontSize: 15 },

  meta: { fontSize: 13, paddingHorizontal: SPACING.gutter, marginBottom: 12 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.gutter,
    marginBottom: 14,
  },
  myBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  myBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  dayTabs: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dayTab: { paddingVertical: 7, paddingHorizontal: 20 },
  dayTabText: { fontSize: 13 },

  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  hero: {
    marginTop: 8,
    marginHorizontal: SPACING.gutter,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  headline: { fontSize: 26, fontWeight: '700', marginTop: 6, lineHeight: 34 },

  itemRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 12 },
  chip: { alignItems: 'center', gap: 4 },
  chipLabel: { fontSize: 11 },
  chipFallback: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFallbackText: { fontSize: 9, textAlign: 'center', lineHeight: 12 },

  divider: { height: StyleSheet.hairlineWidth, marginTop: 18, marginBottom: 14 },
  subLabel: { fontSize: 12, marginBottom: 2 },

  section: { marginTop: 8 },
  reasons: { marginTop: 10, paddingHorizontal: SPACING.gutter, gap: 5 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  reasonText: { fontSize: 13, flex: 1 },
  controls: {
    marginTop: 8,
    paddingHorizontal: SPACING.gutter,
  },
  controlGap: { marginTop: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingHorizontal: SPACING.gutter,
  },

  stats: {
    flexDirection: 'row',
    marginHorizontal: SPACING.gutter,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 11 },

  hourScroll: { paddingHorizontal: SPACING.gutter, gap: 4 },
  hourCell: { width: 50, alignItems: 'center', gap: 8 },
  hourTemp: { fontSize: 13 },
  barTrack: { height: 40, justifyContent: 'flex-end' },
  bar: { width: 3, borderRadius: 2 },
  hourLabel: { fontSize: 12 },

  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.gutter,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsText: { fontSize: 13, flex: 1 },
  verdictRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.gutter },
  verdict: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  verdictText: { fontSize: 13 },
  verdictNote: {
    fontSize: 11,
    paddingHorizontal: SPACING.gutter,
    marginTop: 8,
    lineHeight: 16,
  },
  settingsLink: { fontSize: 14, fontWeight: '600' },

  footer: { marginTop: 8, paddingHorizontal: SPACING.gutter, gap: 4 },
  footerText: { fontSize: 11, lineHeight: 16 },

  errorText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 40 },
  retry: { fontSize: 15, fontWeight: '600' },
});
