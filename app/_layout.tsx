// app/_layout.tsx
import '../services/location-bg';
import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '../hooks/useColorScheme';
import { AuthProvider } from '../providers/AuthProvider';
import { PersonaTargetProvider } from '../providers/PersonaTargetProvider';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <AuthProvider>
       <PersonaTargetProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerTitleAlign: 'center' }}>
          {/* Tabs group */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* Detail screens that should hide the tab bar */}
          <Stack.Screen name="voice-chat" options={{ title: 'Voice Chat' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="VoiceClone/index" options={{ title: 'Voice Clone' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="lobby/index" options={{ title: 'Lobby' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
      </PersonaTargetProvider>
    </AuthProvider>
  );
}
