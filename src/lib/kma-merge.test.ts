import { mergeHourly } from '@/lib/weather';
import type { HourPoint } from '@/lib/recommend';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => {
  c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (d ? ' — ' + d : '')));
};

const mk = (time: string, over: Partial<HourPoint> = {}): HourPoint => ({
  time, temp: 20, feelsLike: 20, humidity: 60, wind: 5, windGust: 9,
  precipProb: 0, precipAmount: 0, uvIndex: 4, weatherCode: 1, isDay: true, ...over,
});

console.log('\n── 기상청 + Open-Meteo 병합 ──\n');

const om = [
  mk('2026-10-17T14:00:00+09:00', { temp: 24, humidity: 63, uvIndex: 5 }),
  mk('2026-10-17T15:00:00+09:00', { temp: 24, humidity: 63, uvIndex: 4, isDay: true }),
  mk('2026-10-21T15:00:00+09:00', { temp: 18, humidity: 70, uvIndex: 2 }), // 기상청 범위 밖
];
const kma = [
  mk('2026-10-17T14:00:00+09:00', { temp: 25, humidity: 48, uvIndex: null, isDay: true, windGust: null }),
  mk('2026-10-17T15:00:00+09:00', { temp: 25, humidity: 47, uvIndex: null, isDay: true, windGust: null }),
];

const merged = mergeHourly(om, kma);
check('길이 유지', merged.length === 3);
check('기상청 기온이 우선', merged[0].temp === 25, String(merged[0].temp));
check('기상청 습도가 우선', merged[0].humidity === 48, String(merged[0].humidity));
check('자외선은 Open-Meteo 유지', merged[0].uvIndex === 5, String(merged[0].uvIndex));
check('돌풍도 Open-Meteo 유지', merged[0].windGust === 9, String(merged[0].windGust));
check('기상청 범위 밖은 그대로', merged[2].temp === 18 && merged[2].humidity === 70);
check('기상청이 비면 원본 그대로', mergeHourly(om, []).length === 3 && mergeHourly(om, [])[0].temp === 24);

console.log(`\n${fail === 0 ? '통과' : '실패'} — ${pass}개 통과, ${fail}개 실패\n`);
process.exit(fail === 0 ? 0 : 1);
