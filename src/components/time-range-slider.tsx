import { useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const INK = '#0B0B0C';
const MUTED = '#8E8E93';
const LINE = '#E6E6E8';

const MIN_HOUR = 0;
const MAX_HOUR = 24;
/** 외출 구간은 최소 1시간 — 두 손잡이가 겹치면 분석할 구간이 없어진다 */
const MIN_SPAN = 1;
const THUMB = 22;

function hhmm(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function parseHour(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const h = Number(v.slice(0, 2));
  return Number.isFinite(h) ? Math.min(MAX_HOUR, Math.max(MIN_HOUR, h)) : fallback;
}

/**
 * 외출 시작·종료를 끌어서 정하는 두 손잡이 슬라이더.
 *
 * 패키지를 쓰지 않고 PanResponder로 직접 만든 이유는 두 가지다.
 * 설치 단계를 늘리지 않으려는 것과, 같은 코드가 웹(PWA)에서도 그대로 돌아야 하기 때문.
 */
export function TimeRangeSlider({
  departAt,
  returnAt,
  onChange,
}: {
  departAt: string | null;
  returnAt: string | null;
  onChange: (departAt: string, returnAt: string) => void;
}) {
  const [depart, setDepart] = useState(() => parseHour(departAt, 8));
  const [ret, setRet] = useState(() => parseHour(returnAt, 19));
  const [width, setWidth] = useState(0);

  // PanResponder는 생성 시점의 값을 가둬버리므로 ref로 최신값을 본다
  const widthRef = useRef(0);
  const departRef = useRef(depart);
  const retRef = useRef(ret);
  departRef.current = depart;
  retRef.current = ret;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const usable = Math.max(width - THUMB, 1);
  const xOf = (hour: number) => ((hour - MIN_HOUR) / (MAX_HOUR - MIN_HOUR)) * usable;

  const hourFromDx = (startHour: number, dx: number) => {
    const perHour = Math.max(widthRef.current - THUMB, 1) / (MAX_HOUR - MIN_HOUR);
    return Math.round(startHour + dx / perHour);
  };

  const makeResponder = (which: 'depart' | 'return') => {
    let startHour = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startHour = which === 'depart' ? departRef.current : retRef.current;
      },
      onPanResponderMove: (_, g) => {
        const raw = hourFromDx(startHour, g.dx);
        if (which === 'depart') {
          const next = Math.min(Math.max(raw, MIN_HOUR), retRef.current - MIN_SPAN);
          if (next !== departRef.current) {
            departRef.current = next;
            setDepart(next);
          }
        } else {
          const next = Math.max(Math.min(raw, MAX_HOUR), departRef.current + MIN_SPAN);
          if (next !== retRef.current) {
            retRef.current = next;
            setRet(next);
          }
        }
      },
      onPanResponderRelease: () => {
        onChange(hhmm(departRef.current), hhmm(retRef.current));
      },
      onPanResponderTerminate: () => {
        onChange(hhmm(departRef.current), hhmm(retRef.current));
      },
    });
  };

  const departPan = useRef(makeResponder('depart')).current;
  const returnPan = useRef(makeResponder('return')).current;

  const span = ret - depart;

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.time}>{hhmm(depart)}</Text>
        <Text style={styles.dash}>~</Text>
        <Text style={styles.time}>{hhmm(ret)}</Text>
        <Text style={styles.span}>{span}시간</Text>
      </View>

      <View style={styles.sliderArea} onLayout={onLayout}>
        <View style={styles.track} />
        {width > 0 && (
          <View
            style={[
              styles.fill,
              { left: xOf(depart) + THUMB / 2, width: Math.max(xOf(ret) - xOf(depart), 2) },
            ]}
          />
        )}
        {width > 0 && (
          <>
            <View
              {...departPan.panHandlers}
              style={[styles.thumb, { left: xOf(depart) }]}
              hitSlop={{ top: 16, bottom: 16, left: 11, right: 11 }}
            />
            <View
              {...returnPan.panHandlers}
              style={[styles.thumb, { left: xOf(ret) }]}
              hitSlop={{ top: 16, bottom: 16, left: 11, right: 11 }}
            />
          </>
        )}
      </View>

      <View style={styles.scale}>
        {[0, 6, 12, 18, 24].map((h) => (
          <Text key={h} style={styles.scaleText}>
            {h}시
          </Text>
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  time: { fontSize: 17, fontWeight: '600', color: INK, fontVariant: ['tabular-nums'] },
  dash: { fontSize: 14, color: MUTED },
  span: { fontSize: 12, color: MUTED, marginLeft: 4 },

  sliderArea: { height: THUMB + 10, justifyContent: 'center', marginTop: 8, marginHorizontal: 2 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: LINE,
    marginHorizontal: THUMB / 2,
  },
  fill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: INK,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.25,
    borderColor: INK,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
    paddingHorizontal: 2,
  },
  scaleText: { fontSize: 10, color: '#C7C7CC' },

});
