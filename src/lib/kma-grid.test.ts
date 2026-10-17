/**
 * 격자 변환 검증 — 기상청이 공개한 지점 목록의 실제 값과 맞춰본다.
 * 실행: npx tsx src/lib/kma-grid.test.ts
 */
import { latestBaseTime, nowcastBaseTime, toGrid } from '@/lib/kma-grid';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => {
  c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (d ? ' — ' + d : '')));
};

console.log('\n── 위경도 → 기상청 격자 ──\n');

// 기상청 지점 목록의 알려진 값
const CASES: [string, number, number, number, number][] = [
  ['서울 종로구', 37.5729, 126.9794, 60, 127],
  ['인천 중구',   37.4738, 126.6216, 54, 125],
  ['부산 중구',   35.1061, 129.0324, 98, 75],
  ['대구 중구',   35.8694, 128.6063, 89, 90],
  ['대전 중구',   36.3254, 127.4214, 68, 100],
  ['광주 동구',   35.1460, 126.9231, 60, 74],
  ['제주 제주시', 33.4996, 126.5312, 53, 38],
];

for (const [name, lat, lon, ex, ey] of CASES) {
  const g = toGrid(lat, lon);
  const ok = Math.abs(g.nx - ex) <= 1 && Math.abs(g.ny - ey) <= 1;
  check(`${name} → (${g.nx}, ${g.ny})`, ok, `기대 (${ex}, ${ey})`);
}

console.log('\n── 발표 시각 계산 ──\n');

// 한국 시간 기준으로 계산되어야 한다 (기기 시간대와 무관)
{
  const t = latestBaseTime(new Date('2026-10-17T05:30:00+09:00')); // KST 05:30
  check('KST 05:30 → 05시 발표', t.baseTime === '0500' && t.baseDate === '20261017', JSON.stringify(t));
}
{
  const t = latestBaseTime(new Date('2026-10-17T05:05:00+09:00')); // 발표 직후 5분
  check('KST 05:05 → 아직 안 올라와 02시 발표', t.baseTime === '0200', JSON.stringify(t));
}
{
  const t = latestBaseTime(new Date('2026-10-17T00:30:00+09:00')); // 자정 직후
  check('KST 00:30 → 전날 23시 발표', t.baseTime === '2300' && t.baseDate === '20261016', JSON.stringify(t));
}
{
  const t = latestBaseTime(new Date('2026-10-17T23:59:00+09:00'));
  check('KST 23:59 → 당일 23시 발표', t.baseTime === '2300' && t.baseDate === '20261017', JSON.stringify(t));
}
{
  const t = nowcastBaseTime(new Date('2026-10-17T14:50:00+09:00'));
  check('실황 KST 14:50 → 14시', t.baseTime === '1400', JSON.stringify(t));
}
{
  const t = nowcastBaseTime(new Date('2026-10-17T14:20:00+09:00'));
  check('실황 KST 14:20 → 아직 13시', t.baseTime === '1300', JSON.stringify(t));
}
{
  const t = nowcastBaseTime(new Date('2026-10-17T00:20:00+09:00'));
  check('실황 자정 직후 → 전날 23시', t.baseTime === '2300' && t.baseDate === '20261016', JSON.stringify(t));
}

console.log(`\n${fail === 0 ? '통과' : '실패'} — ${pass}개 통과, ${fail}개 실패\n`);
process.exit(fail === 0 ? 0 : 1);
