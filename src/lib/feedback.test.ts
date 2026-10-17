import { analyze, summarize, type FeedbackRecord } from '@/lib/feedback';
import type { ProfileType } from '@/lib/settings';

let pass=0, fail=0;
const check=(n:string,c:boolean,d='')=>{c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:'')))};

const rec = (date:string, verdict:'cold'|'good'|'hot'): FeedbackRecord => ({
  date, verdict, submittedAt: date+'T18:00:00+09:00',
  adjustedFeelsLike: 12, outfitWarmth: 4, profileType: 'normal', outfit: ['knit'],
});

console.log('\n── 체감 피드백 경향 분석 ──\n');

check('기록 2건이면 제안 없음', analyze([rec('2026-10-16','cold'),rec('2026-10-15','cold')],'normal') === null);

const three = [rec('2026-10-16','cold'),rec('2026-10-15','cold'),rec('2026-10-14','cold')];
const s = analyze(three,'normal');
check('같은 답 3회면 제안 생성', s !== null);
check('추웠다 3회 → 추위 쪽 한 단계', s?.nextProfile === 'cold', String(s?.nextProfile));

const hot3 = [rec('2026-10-16','hot'),rec('2026-10-15','hot'),rec('2026-10-14','hot')];
check('더웠다 3회 → 더위 쪽 한 단계', analyze(hot3,'normal')?.nextProfile === 'hot');

const mixed = [rec('2026-10-16','cold'),rec('2026-10-15','good'),rec('2026-10-14','cold')];
check('중간에 끊기면 제안 없음', analyze(mixed,'normal') === null);

check('적당했어요가 이어져도 제안 없음',
  analyze([rec('2026-10-16','good'),rec('2026-10-15','good'),rec('2026-10-14','good')],'normal') === null);

const edge = analyze(three,'very_cold');
check('이미 끝 단계면 성향 제안 안 함', edge !== null && edge.nextProfile === null);
check('끝 단계: 다른 안내 문구', !!edge?.message.includes('외출 시간'));

const sum = summarize([rec('a','cold'),rec('b','good'),rec('c','cold')]);
check('집계: 총 3건, 추움 2', sum.total===3 && sum.cold===2 && sum.good===1 && sum.hot===0);

console.log(`\n${fail===0?'통과':'실패'} — ${pass}개 통과, ${fail}개 실패\n`);
process.exit(fail===0?0:1);
