/**
 * 위경도 → 기상청 격자 좌표(nx, ny) 변환.
 *
 * 기상청 단기예보 API는 위경도를 받지 않고 자체 격자 번호만 받는다.
 * 람베르트 정각원뿔도법(LCC)을 쓰며, 아래 상수는 기상청이 공개한 값이다.
 * 격자 한 칸은 5km다.
 */

const RE = 6371.00877; // 지구 반경 (km)
const GRID = 5.0; // 격자 간격 (km)
const SLAT1 = 30.0; // 표준 위도 1
const SLAT2 = 60.0; // 표준 위도 2
const OLON = 126.0; // 기준점 경도
const OLAT = 38.0; // 기준점 위도
const XO = 43; // 기준점 X 격자
const YO = 136; // 기준점 Y 격자

const DEGRAD = Math.PI / 180.0;

export type Grid = { nx: number; ny: number };

export function toGrid(lat: number, lon: number): Grid {
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

/**
 * 단기예보 발표 시각.
 * 하루 8번(02·05·08·11·14·17·20·23시) 발표되고, 발표 후 약 10분 뒤부터 조회된다.
 * 아직 안 올라온 회차를 요청하면 빈 응답이 오므로 한 회차 전을 쓴다.
 */
export function latestBaseTime(now: Date): { baseDate: string; baseTime: string } {
  const SLOTS = [2, 5, 8, 11, 14, 17, 20, 23];

  // 기상청 기준은 한국 시간 — 기기 시간대와 무관하게 계산한다
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();

  // 발표 후 10분은 여유를 둔다
  const usable = SLOTS.filter((s) => h > s || (h === s && m >= 10));

  let slot: number;
  const day = new Date(kst);
  if (usable.length === 0) {
    slot = 23;
    day.setUTCDate(day.getUTCDate() - 1); // 전날 23시 발표
  } else {
    slot = usable[usable.length - 1];
  }

  const y = day.getUTCFullYear();
  const mo = String(day.getUTCMonth() + 1).padStart(2, '0');
  const d = String(day.getUTCDate()).padStart(2, '0');

  return {
    baseDate: `${y}${mo}${d}`,
    baseTime: `${String(slot).padStart(2, '0')}00`,
  };
}

/** 초단기실황 발표 시각 — 매시 정시, 40분 뒤부터 조회 가능 */
export function nowcastBaseTime(now: Date): { baseDate: string; baseTime: string } {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  // 40분 전 시각을 쓰면 항상 올라와 있는 회차가 된다
  const safe = new Date(kst.getTime() - 40 * 60_000);

  const y = safe.getUTCFullYear();
  const mo = String(safe.getUTCMonth() + 1).padStart(2, '0');
  const d = String(safe.getUTCDate()).padStart(2, '0');

  return {
    baseDate: `${y}${mo}${d}`,
    baseTime: `${String(safe.getUTCHours()).padStart(2, '0')}00`,
  };
}
