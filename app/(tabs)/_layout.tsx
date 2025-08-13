import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      // keep screens mounted in the view hierarchy
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,

        // ✅ valid for Tabs
        lazy: false,           // mount all tabs up front (no on-demand mount)
        freezeOnBlur: true,    // pause rendering when not focused

        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          // (optionally) you can repeat per-screen:
          // lazy: false,
          // freezeOnBlur: true,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Voice',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="waveform" color={color} />,
          // lazy: false,
          // freezeOnBlur: true,
        }}
      />
    </Tabs>
  );
}

