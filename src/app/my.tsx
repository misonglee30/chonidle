import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';

import { BottomBar } from '@/components/bottom-bar';
import { LocationPicker } from '@/components/location-picker';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { TimeRangeSlider } from '@/components/time-range-slider';
import { palette, SPACING } from '@/constants/weather-theme';
import {
  ACTIVITY_OPTIONS,
  ENV_OPTIONS,
  GENDER_OPTIONS,
  labelOf,
  PROFILE_OPTIONS,
  STYLE_OPTIONS,
  timeLabel,
  type Choice,
} from '@/lib/options';
import {
  analyze,
  clearFeedback,
  loadFeedback,
  summarize,
  VERDICT_LABEL,
  type FeedbackRecord,
} from '@/lib/feedback';
import { useSettings } from '@/lib/settings-context';
import { CITIES } from '@/lib/weather';

const p = palette('cloud', true);

type Editing =
  | null
  | 'gender'
  | 'profile'
  | 'env'
  | 'activity'
  | 'time'
  | 'style'
  | 'city';

export default function MyScreen() {
  const { settings, update, reset } = useSettings();
  const [editing, setEditing] = useState<Editing>(null);
  const [records, setRecords] = useState<FeedbackRecord[]>([]);

  const refresh = useCallback(() => {
    loadFeedback().then(setRecords);
  }, []);

  useEffect(refresh, [refresh]);
  useFocusEffect(refresh);

  const stats = summarize(records);
  const suggestion = analyze(records, settings.profileType);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>내 설정</Text>
            <BackButton />
          </View>

          {suggestion && (
            <View style={styles.suggestion}>
              <Text style={styles.suggestionText}>{suggestion.message}</Text>
              {suggestion.nextProfile && (
                <Pressable
                  onPress={() => update({ profileType: suggestion.nextProfile! })}
                  style={styles.suggestionBtn}>
                  <Text style={styles.suggestionBtnText}>
                    {labelOf(PROFILE_OPTIONS, suggestion.nextProfile)}로 바꾸기
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <Section label="추천 기준">
            <Row
              label="추천 범위"
              value={labelOf(GENDER_OPTIONS, settings.gender)}
              onPress={() => setEditing('gender')}
            />
            <Row
              label="체감 성향"
              value={labelOf(PROFILE_OPTIONS, settings.profileType)}
              onPress={() => setEditing('profile')}
            />
            <Row
              label="바람·습도"
              value={labelOf(ENV_OPTIONS, settings.envSensitivity)}
              onPress={() => setEditing('env')}
            />
            <Row
              label="활동 환경"
              value={labelOf(ACTIVITY_OPTIONS, settings.activity)}
              onPress={() => setEditing('activity')}
            />
            <Row
              label="외출 시간"
              value={timeLabel(settings.departAt, settings.returnAt)}
              onPress={() => setEditing('time')}
            />
            <Row
              label="스타일"
              value={labelOf(STYLE_OPTIONS, settings.style)}
              onPress={() => setEditing('style')}
              last
            />
          </Section>

          <Section label="지역">
            <Row
              label={settings.locationMode === 'gps' ? '현재 위치' : '지역'}
              value={
                settings.locationMode === 'gps' && settings.gpsLat != null
                  ? (settings.gpsName ?? '현재 위치')
                  : (CITIES.find((c) => c.id === settings.cityId)?.name ?? '서울')
              }
              onPress={() => setEditing('city')}
              last
            />
          </Section>

          <Section label="체감 기록">
            {stats.total === 0 ? (
              <Text style={styles.empty}>
                아직 기록이 없어요. 오늘 화면 아래에서 추천이 어땠는지 알려주시면{'\n'}
                같은 경향이 쌓일 때 성향 조정을 제안해드려요.
              </Text>
            ) : (
              <>
                <View style={styles.statRow}>
                  <Stat label="추웠어요" value={stats.cold} />
                  <Stat label="적당했어요" value={stats.good} />
                  <Stat label="더웠어요" value={stats.hot} />
                </View>
                <View style={styles.history}>
                  {records.slice(0, 7).map((r) => (
                    <View key={r.date} style={styles.historyRow}>
                      <Text style={styles.historyDate}>
                        {Number(r.date.slice(5, 7))}/{Number(r.date.slice(8, 10))}
                      </Text>
                      <Text style={styles.historyVerdict}>{VERDICT_LABEL[r.verdict]}</Text>
                      <Text style={styles.historyMeta}>체감 {r.adjustedFeelsLike}°</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Section>

          <Section label="앱 관리">
            <Row
              label="체감 기록 지우기"
              value=""
              danger
              onPress={() => {
                clearFeedback().then(refresh);
              }}
            />
            <Row
              label="모든 설정 초기화"
              value=""
              danger
              last
              onPress={() => {
                clearFeedback();
                reset();
              }}
            />
          </Section>

          <Text style={styles.note}>
            설정과 기록은 이 기기에만 저장돼요. 서버로 보내지 않습니다.
          </Text>
        </ScrollView>

        <BottomBar p={p} />
      </SafeAreaView>

      <EditSheet editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

/* ------------------------------------------------------------------ 조각 */

function BackButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.replace('/')} hitSlop={10} style={styles.backBtn}>
      <Text style={styles.backBtnText}>닫기</Text>
    </Pressable>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  last,
  danger,
}: {
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, last && styles.rowLast]}>
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
      <View style={styles.rowRight}>
        {!!value && <Text style={styles.rowValue}>{value}</Text>}
        {!danger && <Text style={styles.chevron}>›</Text>}
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** 항목 하나를 고르는 바텀 시트 */
function EditSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const { settings, update } = useSettings();
  if (!editing) return null;

  const config: {
    title: string;
    options: Choice<any>[];
    selected: any;
    apply: (v: any) => void;
    equals?: (a: any, b: any) => boolean;
  } = (() => {
    switch (editing) {
      case 'gender':
        return {
          title: '추천 범위',
          options: GENDER_OPTIONS,
          selected: settings.gender,
          apply: (v) => update({ gender: v }),
        };
      case 'profile':
        return {
          title: '체감 성향',
          options: PROFILE_OPTIONS,
          selected: settings.profileType,
          apply: (v) => update({ profileType: v }),
        };
      case 'env':
        return {
          title: '바람·습도 민감도',
          options: ENV_OPTIONS,
          selected: settings.envSensitivity,
          apply: (v) => update({ envSensitivity: v }),
        };
      case 'activity':
        return {
          title: '활동 환경',
          options: ACTIVITY_OPTIONS,
          selected: settings.activity,
          apply: (v) => update({ activity: v }),
        };
      case 'time':
        // 아래에서 따로 처리한다 (TimeRangeSlider)
        return { title: '외출 시간', options: [], selected: null, apply: () => {} };
      case 'style':
        // 아래에서 따로 처리한다 (SegmentedTabs)
        return { title: '스타일', options: [], selected: null, apply: () => {} };
      case 'city':
        // 아래에서 따로 처리한다 (LocationPicker)
        return { title: '지역', options: [], selected: null, apply: () => {} };
    }
  })();

  const same = (a: any, b: any) => (config.equals ? config.equals(a, b) : a === b);

  if (editing === 'style') {
    return (
      <Modal transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>스타일</Text>
          <SegmentedTabs
            options={STYLE_OPTIONS}
            value={settings.style}
            onChange={(v) => update({ style: v })}
          />
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <Text style={styles.sheetCloseText}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  if (editing === 'time') {
    return (
      <Modal transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>외출 시간</Text>
          <TimeRangeSlider
            departAt={settings.departAt}
            returnAt={settings.returnAt}
            onChange={(d, r) => update({ departAt: d, returnAt: r })}
          />
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <Text style={styles.sheetCloseText}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  if (editing === 'city') {
    return (
      <Modal transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>지역</Text>
          <LocationPicker settings={settings} onChange={update} />
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <Text style={styles.sheetCloseText}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{config.title}</Text>
        {config.options.map((opt, i) => {
          const active = same(opt.value, config.selected);
          return (
            <Pressable
              key={i}
              onPress={() => {
                config.apply(opt.value);
                onClose();
              }}
              style={[styles.sheetOption, active && styles.sheetOptionOn]}>
              <View style={styles.sheetTextWrap}>
                <Text style={[styles.sheetLabel, active && styles.bold]}>{opt.label}</Text>
                {opt.hint && <Text style={styles.sheetHint}>{opt.hint}</Text>}
              </View>
              {active && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
        <Pressable onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/* ----------------------------------------------------------------- 스타일 */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg },
  scroll: { paddingBottom: 32, paddingTop: 8 },
  bold: { fontWeight: '700' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.gutter,
    marginBottom: 18,
  },
  title: { fontSize: 26, fontWeight: '700', color: p.text },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backBtnText: { fontSize: 14, color: p.muted },

  suggestion: {
    marginHorizontal: SPACING.gutter,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: p.wash,
    gap: 10,
  },
  suggestionText: { fontSize: 14, color: p.text, lineHeight: 20 },
  suggestionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: p.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  suggestionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  section: { marginBottom: 22 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
    color: p.muted,
    paddingHorizontal: SPACING.gutter,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: SPACING.gutter,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: p.line,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 15, color: p.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 14, color: p.muted },
  chevron: { fontSize: 18, color: '#C9C9CE' },
  danger: { color: '#C2443A' },

  empty: {
    fontSize: 13,
    color: p.muted,
    lineHeight: 20,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, color: p.text },
  statLabel: { fontSize: 11, color: p.muted },

  history: { paddingVertical: 4 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    gap: 12,
  },
  historyDate: { fontSize: 13, color: p.muted, width: 44 },
  historyVerdict: { fontSize: 14, color: p.text, flex: 1 },
  historyMeta: { fontSize: 12, color: p.muted },

  note: {
    fontSize: 11,
    color: p.muted,
    paddingHorizontal: SPACING.gutter,
    lineHeight: 16,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: p.text, marginBottom: 14 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: p.line,
  },
  sheetOptionOn: { borderColor: p.text, backgroundColor: '#FAFAFA' },
  sheetTextWrap: { flex: 1, gap: 2 },
  sheetLabel: { fontSize: 15, color: p.text },
  sheetHint: { fontSize: 12, color: p.muted },
  check: { fontSize: 16, color: p.text },
  sheetClose: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  sheetCloseText: { fontSize: 15, color: p.muted },
});
