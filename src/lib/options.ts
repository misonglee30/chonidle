/**
 * 설정 선택지 — 온보딩과 MY 화면이 같이 쓴다.
 * 한쪽만 고치면 두 화면 문구가 어긋나므로 한곳에 둔다.
 */

import type { Activity, EnvSensitivity, Gender, ProfileType, Style } from '@/lib/settings';

export type Choice<T> = { value: T; label: string; hint?: string };

export const GENDER_OPTIONS: Choice<Gender>[] = [
  { value: 'female', label: '여성' },
  { value: 'male', label: '남성' },
];

export const PROFILE_OPTIONS: Choice<ProfileType>[] = [
  { value: 'very_cold', label: '추위를 많이 타요' },
  { value: 'cold', label: '조금 추위를 타요' },
  { value: 'normal', label: '보통이에요' },
  { value: 'hot', label: '조금 더위를 타요' },
  { value: 'very_hot', label: '더위를 많이 타요' },
];

export const ENV_OPTIONS: Choice<EnvSensitivity>[] = [
  { value: 'high', label: '많이 신경 쓰여요', hint: '바람 불거나 습하면 금방 불편해요' },
  { value: 'normal', label: '보통이에요' },
  { value: 'low', label: '별로 신경 안 써요', hint: '웬만한 바람·습도는 괜찮아요' },
];

export const ACTIVITY_OPTIONS: Choice<Activity>[] = [
  { value: 'indoor', label: '실내 중심', hint: '출퇴근 때만 밖에 있어요' },
  { value: 'mixed', label: '실내외 반반' },
  { value: 'outdoor', label: '야외 중심', hint: '하루 대부분 밖에 있어요' },
];

export type TimeSlot = { depart: string; return: string };

export const TIME_OPTIONS: Choice<TimeSlot>[] = [
  { value: { depart: '07:00', return: '19:00' }, label: '아침 일찍 나가요', hint: '07:00 ~ 19:00' },
  { value: { depart: '08:00', return: '19:00' }, label: '보통 출퇴근 시간', hint: '08:00 ~ 19:00' },
  { value: { depart: '10:00', return: '22:00' }, label: '늦게 나가고 늦게 들어와요', hint: '10:00 ~ 22:00' },
  { value: { depart: '', return: '' }, label: '정해져 있지 않아요', hint: '지금부터 3시간을 봐요' },
];

export const STYLE_OPTIONS: Choice<Style>[] = [
  { value: 'casual', label: '캐주얼', hint: '청바지, 후드티, 운동화' },
  { value: 'minimal', label: '미니멀', hint: '단정한 니트, 코트' },
  { value: 'office', label: '오피스', hint: '셔츠, 슬랙스, 구두' },
  { value: 'sporty', label: '스포티', hint: '활동하기 편한 옷' },
];

export function labelOf<T>(options: Choice<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? '';
}

export function timeLabel(departAt: string | null, returnAt: string | null): string {
  return departAt && returnAt ? `${departAt} ~ ${returnAt}` : '지금부터 3시간';
}
