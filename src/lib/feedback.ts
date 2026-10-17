/**
 * 체감 피드백 — 기기 내부 저장.
 *
 * 1차에서는 기록만 하고 추천 보정에 쓰지 않는다. 한 번 "추웠다"고 눌렀다고
 * 바로 보정값을 바꾸면 그날 하루 컨디션이 영구 설정이 되어버린다.
 * 대신 같은 경향이 3회 이상 쌓이면 MY 화면에서 조정을 제안한다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ProfileType } from '@/lib/settings';

export type Verdict = 'cold' | 'good' | 'hot';

export type FeedbackRecord = {
  /** 하루 한 건 — 날짜가 곧 id */
  date: string;
  verdict: Verdict;
  submittedAt: string;
  /** 학습용 스냅샷 — 나중에 보정 로직을 붙일 때 쓴다 */
  adjustedFeelsLike: number;
  outfitWarmth: number;
  profileType: ProfileType;
  outfit: string[];
};

const KEY = 'chonidle.feedback.v1';
const MAX_RECORDS = 60;

export const VERDICT_LABEL: Record<Verdict, string> = {
  cold: '추웠어요',
  good: '적당했어요',
  hot: '더웠어요',
};

export async function loadFeedback(): Promise<FeedbackRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 같은 날짜가 있으면 덮어쓴다 (마음이 바뀔 수 있다) */
export async function saveFeedback(record: FeedbackRecord): Promise<FeedbackRecord[]> {
  const all = await loadFeedback();
  const next = [record, ...all.filter((r) => r.date !== record.date)].slice(0, MAX_RECORDS);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장 실패해도 앱은 계속 동작한다 */
  }
  return next;
}

export async function clearFeedback(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/* ------------------------------------------------------------- 경향 분석 */

const ORDER: ProfileType[] = ['very_cold', 'cold', 'normal', 'hot', 'very_hot'];

export type Suggestion = {
  /** 연속으로 같은 답이 나온 횟수 */
  streak: number;
  verdict: Verdict;
  /** 제안할 성향 — 더 바꿀 단계가 없으면 null */
  nextProfile: ProfileType | null;
  message: string;
};

/**
 * 최근 기록에서 같은 경향이 3회 이상 이어지면 성향 조정을 제안한다.
 * 제안만 하고 자동으로 바꾸지는 않는다 — 사용자가 납득하고 눌러야 한다.
 */
export function analyze(
  records: FeedbackRecord[],
  current: ProfileType
): Suggestion | null {
  if (records.length < 3) return null;

  const first = records[0].verdict;
  if (first === 'good') return null;

  let streak = 0;
  for (const r of records) {
    if (r.verdict === first) streak++;
    else break;
  }
  if (streak < 3) return null;

  const idx = ORDER.indexOf(current);
  // 추웠다 → 추위를 더 타는 쪽(앞)으로, 더웠다 → 뒤로
  const nextIdx = first === 'cold' ? idx - 1 : idx + 1;
  const nextProfile = nextIdx >= 0 && nextIdx < ORDER.length ? ORDER[nextIdx] : null;

  const message =
    nextProfile === null
      ? `${streak}번 연속 ${VERDICT_LABEL[first]}. 성향은 이미 끝 단계라 외출 시간이나 활동 환경을 확인해보세요.`
      : `${streak}번 연속 ${VERDICT_LABEL[first]}. 체감 성향을 한 단계 조정해볼까요?`;

  return { streak, verdict: first, nextProfile, message };
}

/** 요약 — MY 화면에 보여줄 집계 */
export function summarize(records: FeedbackRecord[]) {
  const count = { cold: 0, good: 0, hot: 0 };
  for (const r of records) count[r.verdict]++;
  return { total: records.length, ...count };
}
