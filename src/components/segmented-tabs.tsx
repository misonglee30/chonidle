import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const INK = '#0B0B0C';
const MUTED = '#8E8E93';
const LINE = '#E6E6E8';

export type SegmentOption<T> = { value: T; label: string; hint?: string };

/**
 * 가로 세그먼트 탭. 선택 표시가 미끄러지듯 움직인다.
 *
 * 선택지가 넷 이하이고 서로 배타적일 때 라디오 목록보다 낫다.
 * 한 줄에 다 보여서 비교가 되고, 누르는 거리도 짧다.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: index,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
  }, [index, slide]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const cell = width > 0 ? (width - 6) / options.length : 0;

  return (
    <View>
      <View style={styles.bar} onLayout={onLayout}>
        {cell > 0 && (
          <Animated.View
            style={[
              styles.pill,
              {
                width: cell,
                transform: [
                  {
                    translateX: slide.interpolate({
                      inputRange: options.map((_, i) => i),
                      outputRange: options.map((_, i) => i * cell),
                    }),
                  },
                ],
              },
            ]}
          />
        )}

        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              style={styles.cell}
              onPress={() => onChange(opt.value)}>
              <Text
                style={[styles.label, active ? styles.labelOn : styles.labelOff]}
                numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F4',
    borderRadius: 12,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  pill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cell: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13 },
  labelOn: { color: INK, fontWeight: '700' },
  labelOff: { color: MUTED },
});
