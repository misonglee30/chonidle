import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsProvider, useSettings } from '@/lib/settings-context';
import { WeatherProvider } from '@/lib/weather-context';

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <WeatherProvider>
          <Gate />
        </WeatherProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

/** 온보딩을 마치지 않았으면 온보딩으로 보낸다 */
function Gate() {
  const { settings, loading } = useSettings();
  const segments = useSegments();
  const router = useRouter();

  const onOnboarding = segments[0] === 'onboarding';

  useEffect(() => {
    if (loading) return;
    if (!settings.onboarded && !onOnboarding) {
      router.replace('/onboarding');
    }
  }, [loading, settings.onboarded, onOnboarding, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#8E8E93" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
