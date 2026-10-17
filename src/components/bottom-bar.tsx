import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';

import type { palette } from '@/constants/weather-theme';

const TABS = [
  { path: '/', label: '오늘' },
  { path: '/forecast', label: '예보' },
] as const;

/**
 * 하단 탭. expo-router의 Tabs 대신 직접 만든 이유는
 * 라우트를 (tabs) 그룹으로 옮기지 않고도 화면을 늘릴 수 있어서다.
 */
export function BottomBar({ p }: { p: ReturnType<typeof palette> }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          borderTopColor: p.line,
          backgroundColor: p.bg,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}>
      {TABS.map((t) => {
        const active = pathname === t.path;
        return (
          <Pressable
            key={t.path}
            style={styles.tab}
            onPress={() => {
              if (!active) router.replace(t.path);
            }}>
            <Text
              style={[
                styles.label,
                { color: active ? p.text : p.muted },
                active && styles.active,
              ]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 13 },
  active: { fontWeight: '700' },
});
