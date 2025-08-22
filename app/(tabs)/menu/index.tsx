// app/(tabs)/menu/index.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { ThemedText } from '../../../components/ThemedText';
import { ThemedView } from '../../../components/ThemedView';
import { IconSymbol } from '../../../components/ui/IconSymbol';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Use the IconSymbolName type from IconSymbol.tsx, plus 'waveform' for MaterialCommunityIcons
type IconSymbolName =
  | 'person.crop.circle'
  | 'voice.chat'
  | 'waveform.circle'
  | 'gear'
  | 'waveform'; // Add 'waveform' for special case

const R = {
  settings: '/settings',
  voiceChat: '/voice-chat',
  voiceClone: '/VoiceClone',
  profile: '/profile',
} as const satisfies Record<string, Href>; // ✅ forces correct type

const MENU_ITEMS: Array<{
  key: keyof typeof R;
  title: string;
  subtitle?: string;
  icon: IconSymbolName;
}> = [
  {
    key: 'profile',
    title: 'Profile',
    subtitle: 'Your account',
    icon: 'person.crop.circle',
  },
  {
    key: 'voiceChat',
    title: 'Voice Chat',
    subtitle: 'Talk to the orb',
    icon: 'waveform.circle',
  },
  {
    key: 'voiceClone',
    title: 'Voice Clone',
    subtitle: 'Create your voice',
    icon: 'waveform', // Use the new waveform icon
  },
  {
    key: 'settings',
    title: 'Settings',
    subtitle: 'App preferences',
    icon: 'gear',
  },
];

const Item = ({
  title,
  subtitle,
  to,
  icon,
}: {
  title: string;
  subtitle?: string;
  to: Href;
  icon: IconSymbolName;
}) => (
  <Link href={to} asChild>
    <Pressable style={styles.item}>
      <View style={styles.itemRow}>
        {icon === 'waveform' ? (
          <MaterialCommunityIcons name="waveform" size={28} color="#888" style={styles.itemIcon} />
        ) : (
          <IconSymbol name={icon as Exclude<IconSymbolName, 'waveform'>} size={28} color="#888" style={styles.itemIcon} />
        )}
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold" style={styles.itemTitle}>{title}</ThemedText>
          {subtitle ? <ThemedText style={styles.itemSub}>{subtitle}</ThemedText> : null}
        </View>
      </View>
    </Pressable>
  </Link>
);

export default function MenuScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Menu</ThemedText>
      <View style={styles.list}>
        {MENU_ITEMS.map(item => (
          <Item
            key={item.key}
            title={item.title}
            subtitle={item.subtitle}
            to={R[item.key]}
            icon={item.icon}
          />
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  title: { textAlign: 'center', marginTop: 16, marginBottom: 12 },
  list: { gap: 12 },
  item: { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.3)' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  itemIcon: { marginRight: 8 },
  itemTitle: { fontSize: 18, marginBottom: 4 },
  itemSub: { opacity: 0.7 },
});
