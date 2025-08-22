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
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors['dark'].tint,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        lazy: false,
        freezeOnBlur: true,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute', backgroundColor: 'black' },
          default: { backgroundColor: 'black' },
        }),
      }}
    >
            <Tabs.Screen
        name="AboutMe/index"
        options={{
          title: 'About Me',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu/index"
        options={{
          title: 'Menu',
          // Use a different icon that exists, e.g. "person.crop.circle"
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="menu" color={color} />,
        }}
      />
    </Tabs>
  );
}
