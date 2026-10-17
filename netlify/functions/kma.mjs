/**
 * 기상청 중계 함수.
 *
 * 브라우저는 보안 규칙(CORS) 때문에 data.go.kr을 직접 부르지 못한다.
 * 그래서 우리 사이트 주소(/api/kma)로 들어온 요청을 이 함수가 대신 불러다 준다.
 * 덤으로 인증키가 서버에만 남아 브라우저에 노출되지 않는다.
 *
 * 앱(Expo Go·네이티브)은 CORS 제약이 없으므로 이 함수를 거치지 않고 직접 부른다.
 *
 * 인증키는 Netlify 환경변수 KMA_KEY 로 넣는다. 코드에 적지 않는다.
 */

const BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

/** 중계를 허용하는 엔드포인트. 이 함수가 아무 주소나 대신 부르는 통로가 되면 안 된다 */
const ALLOWED_PATHS = new Set([
  'getVilageFcst',    // 단기예보
  'getUltraSrtNcst',  // 초단기실황
  'getUltraSrtFcst',  // 초단기예보
]);

/** 그대로 넘기는 파라미터 — 숫자만 통과시킨다 */
const PASS_THROUGH = ['base_date', 'base_time', 'nx', 'ny'];

function jsonError(code, status) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * data.go.kr은 인증키를 두 형태로 준다 — 원본(Decoding)과 %로 감싼 것(Encoding).
 * 인코딩된 키를 그대로 쓰면 두 번 인코딩되어 인증이 깨지므로 한 번 풀어준다.
 * 어느 쪽을 복사해 넣어도 동작하게 하기 위한 장치다.
 */
function normalizeKey(raw) {
  const k = raw.trim();
  return k.includes('%') ? decodeURIComponent(k) : k;
}

export default async (req) => {
  const raw = process.env.KMA_KEY;
  if (!raw) {
    return jsonError('KMA_KEY_MISSING', 500);
  }

  const incoming = new URL(req.url);
  const path = incoming.searchParams.get('path') ?? '';
  if (!ALLOWED_PATHS.has(path)) {
    return jsonError('PATH_NOT_ALLOWED', 400);
  }

  const qs = new URLSearchParams({
    serviceKey: normalizeKey(raw),
    dataType: 'JSON',
    numOfRows: '1000',
    pageNo: '1',
  });
  for (const k of PASS_THROUGH) {
    const v = incoming.searchParams.get(k);
    if (v && /^\d{1,8}$/.test(v)) qs.set(k, v);
  }

  let upstream;
  try {
    upstream = await fetch(`${BASE}/${path}?${qs}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return jsonError('UPSTREAM_UNREACHABLE', 502);
  }

  const text = await upstream.text();
  const isXml = text.trim().startsWith('<');

  // 키가 틀리면 기상청이 JSON 대신 XML 오류를 준다.
  // 손대지 않고 그대로 넘겨서 앱이 사유를 판별하게 둔다.
  return new Response(text, {
    status: upstream.ok ? 200 : 502,
    headers: {
      'content-type': isXml
        ? 'application/xml; charset=utf-8'
        : 'application/json; charset=utf-8',
      // 같은 격자·같은 발표시각이면 응답이 같다. 5분 캐시로 일일 호출 한도를 아낀다.
      'cache-control': 'public, max-age=0, s-maxage=300',
    },
  });
};
