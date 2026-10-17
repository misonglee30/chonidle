/**
 * 기상청 파싱 검증 — 실제 응답 형태를 그대로 흉내 낸 데이터로 돌린다.
 * 실행: npx tsx src/lib/kma.test.ts
 */
import {
  feelsLike,
  KmaError,
  normalizeKey,
  parseForecast,
  parseNowcast,
  parsePcp,
  toWmoCode,
} from '@/lib/kma';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => {
  c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (d ? ' — ' + d : '')));
};

const wrap = (items: any[]) => ({
  response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { items: { item: items } } },
});
const fc = (category: string, fcstValue: string, fcstTime = '1500', fcstDate = '20261017') =>
  ({ category, fcstDate, fcstTime, fcstValue });

console.log('\n── 강수량 문자열 파싱 ──\n');
check('강수없음 → 0', parsePcp('강수없음') === 0);
check('빈값 → 0', parsePcp('') === 0);
check('1.0mm → 1', parsePcp('1.0mm') === 1);
check('"1mm 미만" → 0.5', parsePcp('1mm 미만') === 0.5);
check('"30.0~50.0mm" → 40', parsePcp('30.0~50.0mm') === 40);
check('"50.0mm 이상" → 50', parsePcp('50.0mm 이상') === 50);
check('"-" → 0', parsePcp('-') === 0);

console.log('\n── 하늘상태·강수형태 → WMO ──\n');
check('맑음(SKY1,PTY0) → 0', toWmoCode(1, 0) === 0);
check('구름많음(SKY3) → 2', toWmoCode(3, 0) === 2);
check('흐림(SKY4) → 3', toWmoCode(4, 0) === 3);
check('비(PTY1)가 하늘상태를 이긴다', toWmoCode(1, 1) === 63);
check('눈(PTY3) → 눈 코드', toWmoCode(4, 3) === 73);

console.log('\n── 단기예보 파싱 ──\n');
{
  const json = wrap([
    fc('TMP', '18'), fc('REH', '55'), fc('WSD', '3.0'),
    fc('POP', '30'), fc('PCP', '강수없음'), fc('SKY', '3'), fc('PTY', '0'),
    fc('TMP', '15', '1600'), fc('REH', '70', '1600'), fc('WSD', '5.0', '1600'),
    fc('POP', '80', '1600'), fc('PCP', '1.5mm', '1600'), fc('SKY', '4', '1600'), fc('PTY', '1', '1600'),
  ]);
  const rows = parseForecast(json);
  check('두 시각으로 묶인다', rows.length === 2, String(rows.length));
  check('시간 순 정렬', rows[0].time < rows[1].time);
  check('ISO 변환 + 한국 시간대', rows[0].time === '2026-10-17T15:00:00+09:00', rows[0].time);
  check('풍속 m/s → km/h', Math.abs(rows[0].wind - 10.8) < 0.01, String(rows[0].wind));
  check('습도 그대로', rows[1].humidity === 70);
  check('강수량 문자열 처리', rows[1].precipAmount === 1.5);
}

console.log('\n── 오류 처리 ──\n');
{
  const bad = { response: { header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } };
  let kind = '';
  try { parseForecast(bad as any); } catch (e) { kind = (e as KmaError).kind; }
  check('잘못된 키 → auth', kind === 'auth', kind);
}
{
  const over = { response: { header: { resultCode: '22', resultMsg: 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR' } } };
  let kind = '';
  try { parseForecast(over as any); } catch (e) { kind = (e as KmaError).kind; }
  check('한도 초과 → quota', kind === 'quota', kind);
}
{
  let kind = '';
  try { parseForecast(wrap([]) as any); } catch (e) { kind = (e as KmaError).kind; }
  check('빈 응답 → empty', kind === 'empty', kind);
}

console.log('\n── 초단기실황 ──\n');
{
  const json = wrap([
    { category: 'T1H', obsrValue: '24.3' },
    { category: 'REH', obsrValue: '48' },
    { category: 'WSD', obsrValue: '3.6' },
    { category: 'PTY', obsrValue: '0' },
    { category: 'RN1', obsrValue: '0' },
  ]);
  const n = parseNowcast(json);
  check('기온 읽기', n.temp === 24.3);
  check('습도 읽기', n.humidity === 48);
  check('풍속 km/h 변환', Math.abs(n.wind! - 12.96) < 0.01, String(n.wind));
}

console.log('\n── 체감온도 계산 ──\n');
check('추울 때 바람 불면 더 낮게', feelsLike(5, 20, 50) < 5);
check('추워도 바람 약하면 기온 그대로', feelsLike(5, 2, 50) === 5);
check('선선할 땐 기온 그대로', feelsLike(18, 10, 55) === 18);
check('더울 때 습하면 더 높게', feelsLike(30, 5, 80) > 30);
{
  // 인천 사례: 24°C, 바람 13km/h, 습도 48% → 애플은 체감 23°
  const f = feelsLike(24, 13, 48);
  check('24°C/13km/h/48% → 기온과 비슷', Math.abs(f - 24) < 1.5, String(Math.round(f * 10) / 10));
}

console.log('\n── 인증키 정규화 ──\n');
{
  // 공공데이터포털은 같은 키를 두 형태로 준다. 어느 쪽을 붙여넣어도 통해야 한다.
  const decoded = 'aB3+xY/z9Q==';
  const encoded = 'aB3%2BxY%2Fz9Q%3D%3D';
  check('원본 키는 그대로', normalizeKey(decoded) === decoded);
  check('인코딩된 키는 풀어서', normalizeKey(encoded) === decoded);
  check('앞뒤 공백 제거', normalizeKey('  abc123  ') === 'abc123');
  check('%가 없으면 건드리지 않음', normalizeKey('abcDEF123') === 'abcDEF123');
}

console.log(`\n${fail === 0 ? '통과' : '실패'} — ${pass}개 통과, ${fail}개 실패\n`);
process.exit(fail === 0 ? 0 : 1);
