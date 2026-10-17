import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { LocationPicker } from '@/components/location-picker';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { TimeRangeSlider } from '@/components/time-range-slider';
import { imageOf } from '@/lib/clothing-images';
import { nameOf } from '@/lib/clothing';
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
import { useSettings } from '@/lib/settings-context';
import type { UserSettings } from '@/lib/settings';
import { CITIES } from '@/lib/weather';

const INK = '#0B0B0C';
const MUTED = '#8E8E93';
const LINE = '#E6E6E8';

/* --------------------------------------------------------------- 문항 정의 */

const TOTAL = 7;

/* ------------------------------------------------------------------ 본체 */

export default function Onboarding() {
  const router = useRouter();
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<UserSettings>(settings);

  const set = (patch: Partial<UserSettings>) => setDraft((d) => ({ ...d, ...patch }));

  const isResult = step === TOTAL;

  const next = () => {
    if (step < TOTAL) {
      setStep(step + 1);
      return;
    }
    update({ ...draft, onboarded: true });
    router.replace('/');
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {!isResult && <Progress step={step} />}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <View>
              <Text style={styles.qTitle}>어떤 옷을 추천받을까요?</Text>
              <Text style={styles.qSubtitle}>
                원피스·스커트처럼 한쪽에만 해당하는 옷이 있어서 여쭤요.
              </Text>
              <View style={{ marginTop: 32 }}>
                <SegmentedTabs
                  options={GENDER_OPTIONS}
                  value={draft.gender}
                  onChange={(v) => set({ gender: v })}
                />
              </View>
            </View>
          )}

          {step === 1 && (
            <Question
              title="평소 추위나 더위를 얼마나 타나요?"
              subtitle="같은 온도라도 사람마다 느끼는 정도가 달라요."
              options={PROFILE_OPTIONS}
              selected={draft.profileType}
              onSelect={(v) => set({ profileType: v })}
            />
          )}

          {step === 2 && (
            <Question
              title="바람이나 습도에 민감한 편인가요?"
              subtitle="방풍 겉옷과 통기성 소재를 언제 추천할지 정해요."
              options={ENV_OPTIONS}
              selected={draft.envSensitivity}
              onSelect={(v) => set({ envSensitivity: v })}
            />
          )}

          {step === 3 && (
            <Question
              title="하루를 주로 어디서 보내나요?"
              subtitle="실내에 오래 있으면 출퇴근 시간대를 더 중요하게 봐요."
              options={ACTIVITY_OPTIONS}
              selected={draft.activity}
              onSelect={(v) => set({ activity: v })}
            />
          )}

          {step === 4 && (
            <View>
              <Text style={styles.qTitle}>보통 언제 나갔다가 언제 들어오나요?</Text>
              <Text style={styles.qSubtitle}>그 시간대의 날씨만 골라서 분석해요.</Text>
              <View style={{ marginTop: 32 }}>
                <TimeRangeSlider
                  departAt={draft.departAt}
                  returnAt={draft.returnAt}
                  onChange={(d, r) => set({ departAt: d, returnAt: r })}
                />
              </View>
            </View>
          )}

          {step === 5 && (
            <View>
              <Text style={styles.qTitle}>어떤 옷차림을 선호하세요?</Text>
              <Text style={styles.qSubtitle}>
                같은 보온 수준에서 어떤 옷을 고를지 달라져요.
              </Text>
              <View style={{ marginTop: 32 }}>
                <SegmentedTabs
                  options={STYLE_OPTIONS}
                  value={draft.style}
                  onChange={(v) => set({ style: v })}
                />
              </View>
              <StylePreview style={draft.style} />
            </View>
          )}

          {step === 6 && (
            <View>
              <Text style={styles.qTitle}>어느 지역의 날씨를 볼까요?</Text>
              <Text style={styles.qSubtitle}>
                현재 위치를 쓰면 이동해도 그 지역 날씨로 추천해요.{'\n'}
                권한을 거부해도 아래에서 직접 고르면 그대로 쓸 수 있어요.
              </Text>
              <View style={{ marginTop: 28 }}>
                <LocationPicker settings={draft} onChange={set} />
              </View>
            </View>
          )}

          {isResult && <Result draft={draft} />}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && !isResult && (
            <Pressable onPress={back} style={styles.backBtn} hitSlop={8}>
              <Text style={styles.backText}>이전</Text>
            </Pressable>
          )}
          <Pressable onPress={next} style={styles.cta}>
            <Text style={styles.ctaText}>
              {isResult ? '시작하기' : step === TOTAL - 1 ? '완료' : '다음'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ------------------------------------------------------------------ 조각 */

/** 스타일을 고르면 어떤 옷이 나오는지 바로 보여준다 */
const STYLE_SAMPLE: Record<string, string[]> = {
  casual: ['long_tee', 'light_jacket', 'jeans', 'sneakers'],
  minimal: ['thin_knit', 'coat', 'long_pants', 'boots'],
  office: ['thin_shirt', 'trench_coat', 'long_pants', 'dress_shoes'],
  sporty: ['sweatshirt', 'light_padding', 'sweatpants', 'sneakers'],
};

function StylePreview({ style }: { style: string }) {
  const items = STYLE_SAMPLE[style] ?? [];
  return (
    <View style={styles.stylePreview}>
      <Text style={styles.stylePreviewLabel}>이런 옷이 자주 나와요</Text>
      <View style={styles.stylePreviewRow}>
        {items.map((id) => {
          const src = imageOf(id);
          return (
            <View key={id} style={styles.previewChip}>
              {src && <Image source={src} style={styles.previewImg} resizeMode="contain" />}
              <Text style={styles.previewLabel} numberOfLines={1}>{nameOf(id)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressSeg, i <= step && styles.progressSegOn]}
          />
        ))}
      </View>
      <Text style={styles.progressText}>
        {step + 1} / {TOTAL}
      </Text>
    </View>
  );
}

function Question<T>({
  title,
  subtitle,
  options,
  selected,
  onSelect,
  equals,
}: {
  title: string;
  subtitle?: string;
  options: Choice<T>[];
  selected: T | undefined;
  onSelect: (v: T) => void;
  equals?: (a: T, b: T) => boolean;
}) {
  const same = (a: T, b: T | undefined) =>
    b === undefined ? false : equals ? equals(a, b) : a === b;

  return (
    <View>
      <Text style={styles.qTitle}>{title}</Text>
      {subtitle && <Text style={styles.qSubtitle}>{subtitle}</Text>}

      <View style={styles.options}>
        {options.map((opt, i) => {
          const active = same(opt.value, selected);
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(opt.value)}
              style={[styles.option, active && styles.optionOn]}>
              <View style={[styles.radio, active && styles.radioOn]}>
                {active && <View style={styles.radioDot} />}
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionLabel, active && styles.optionLabelOn]}>
                  {opt.label}
                </Text>
                {opt.hint && <Text style={styles.optionHint}>{opt.hint}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 마지막 화면 — 설정 요약과 앞으로 받게 될 정보 */
function Result({ draft }: { draft: UserSettings }) {
  const cityName =
    draft.locationMode === 'gps' && draft.gpsLat != null
      ? (draft.gpsName ?? '현재 위치')
      : (CITIES.find((c) => c.id === draft.cityId)?.name ?? '서울');
  const profile = labelOf(PROFILE_OPTIONS, draft.profileType);
  const style = labelOf(STYLE_OPTIONS, draft.style);
  const time = timeLabel(draft.departAt, draft.returnAt);

  const sample = ['thin_knit', 'light_jacket', 'jeans', 'sneakers'];

  return (
    <View>
      <Text style={styles.resultKicker}>맞춤 설정 완료</Text>
      <Text style={styles.qTitle}>이제 날씨와 체감 성향을{'\n'}함께 분석할게요</Text>

      <View style={styles.summary}>
        <SummaryRow label="지역" value={cityName} />
        <SummaryRow label="체감 성향" value={profile} />
        <SummaryRow label="외출 시간" value={time} />
        <SummaryRow label="스타일" value={style} />
      </View>

      <Text style={styles.resultSection}>앞으로 이런 정보를 받게 돼요</Text>
      <View style={styles.preview}>
        <Text style={styles.previewHeadline}>가벼운 재킷을 챙기세요</Text>
        <View style={styles.previewRow}>
          {sample.map((id) => {
            const src = imageOf(id);
            return (
              <View key={id} style={styles.previewChip}>
                {src && <Image source={src} style={styles.previewImg} resizeMode="contain" />}
                <Text style={styles.previewLabel}>{nameOf(id)}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.previewNote}>상의 · 하의 · 겉옷 · 준비물을 함께 알려드려요</Text>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

/* ----------------------------------------------------------------- 스타일 */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },

  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  progressRow: { flex: 1, flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: LINE },
  progressSegOn: { backgroundColor: INK },
  progressText: { fontSize: 12, color: MUTED },

  qTitle: { fontSize: 23, fontWeight: '700', color: INK, lineHeight: 32 },
  qSubtitle: { fontSize: 14, color: MUTED, marginTop: 8, lineHeight: 20 },

  options: { marginTop: 28, gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
  },
  optionOn: { borderColor: INK, backgroundColor: '#FAFAFA' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C9C9CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: INK },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: INK },
  optionTextWrap: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, color: INK },
  optionLabelOn: { fontWeight: '600' },
  optionHint: { fontSize: 13, color: MUTED },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: { paddingVertical: 16, paddingHorizontal: 8 },
  backText: { fontSize: 15, color: MUTED },
  cta: {
    flex: 1,
    backgroundColor: INK,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  stylePreview: {
    marginTop: 32,
    backgroundColor: '#F6F7F8',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  stylePreviewLabel: { fontSize: 12, color: MUTED, marginBottom: 12 },
  stylePreviewRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },

  resultKicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: MUTED,
    marginBottom: 10,
  },
  summary: {
    marginTop: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  summaryLabel: { fontSize: 14, color: MUTED },
  summaryValue: { fontSize: 15, color: INK, fontWeight: '500' },

  resultSection: { fontSize: 13, color: MUTED, marginTop: 28, marginBottom: 12 },
  preview: {
    borderRadius: 20,
    backgroundColor: '#F6F7F8',
    padding: 20,
  },
  previewHeadline: { fontSize: 18, fontWeight: '700', color: INK },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 10 },
  previewChip: { alignItems: 'center', width: 72, gap: 2 },
  previewImg: { width: 58, height: 58 },
  previewLabel: { fontSize: 10, color: MUTED },
  previewNote: { fontSize: 12, color: MUTED, marginTop: 12 },
});
