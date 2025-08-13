// app/(tabs)/menu/index.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { ThemedText } from '../../../components/ThemedText';
import { ThemedView } from '../../../components/ThemedView';

const R = {
  settings: '/settings',
  voiceChat: '/voice-chat',
  voiceClone: '/voice-clone',
  profile: '/profile',
} as const satisfies Record<string, Href>; // ✅ forces correct type

const Item = ({ title, subtitle, to }: { title: string; subtitle?: string; to: Href }) => (
  <Link href={to} asChild>
    <Pressable style={styles.item}>
      <ThemedText type="defaultSemiBold" style={styles.itemTitle}>{title}</ThemedText>
      {subtitle ? <ThemedText style={styles.itemSub}>{subtitle}</ThemedText> : null}
    </Pressable>
  </Link>
);

export default function MenuScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Menu</ThemedText>
      <View style={styles.list}>
        <Item title="Settings"    subtitle="App preferences" to={R.settings} />
        <Item title="Voice Chat"  subtitle="Talk to the orb" to={R.voiceChat} />
        <Item title="Voice Clone" subtitle="Create your voice" to={R.voiceClone} />
        <Item title="Profile"     subtitle="Your account" to={R.profile} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  title: { textAlign: 'center', marginTop: 16, marginBottom: 12 },
  list: { gap: 12 },
  item: { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.3)' },
  itemTitle: { fontSize: 18, marginBottom: 4 },
  itemSub: { opacity: 0.7 },
});
