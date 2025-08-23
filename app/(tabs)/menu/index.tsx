// app/(tabs)/menu/index.tsx
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
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

// --- VANTA TOPOLOGY BACKGROUND FOR WEB ---
const isWeb = Platform.OS === 'web';

function VantaTopologyBackground() {
  const vantaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isWeb) return;
    let vantaEffect: any = null;

    function loadScript(src: string) {
      return new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    async function setupVanta() {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/p5@1.4.2/lib/p5.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.topology.min.js');
        if (
          typeof window !== 'undefined' &&
          (window as any).VANTA &&
          (window as any).VANTA.TOPOLOGY &&
          vantaRef.current
        ) {
          vantaEffect = (window as any).VANTA.TOPOLOGY({
            el: vantaRef.current,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            scale: 1.0,
            scaleMobile: 1.0,
            color: 0x4e8e96,
            backgroundColor: 0x0,
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('VANTA TOPOLOGY background failed to load', e);
      }
    }

    setupVanta();

    return () => {
      if (vantaEffect && typeof vantaEffect.destroy === 'function') {
        vantaEffect.destroy();
      }
    };
  }, []);

  // The background div is absolutely positioned and covers the whole screen
  return isWeb ? (
    <div
      ref={vantaRef}
      id="vanta-topology-bg"
      style={{
        position: 'fixed',
        zIndex: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        background: '#000',
      }}
    />
  ) : null;
}

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
          <MaterialCommunityIcons name="waveform" size={28} color="white" style={styles.itemIcon} />
        ) : (
          <IconSymbol name={icon as Exclude<IconSymbolName, 'waveform'>} size={28} color="white" style={styles.itemIcon} />
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
      <VantaTopologyBackground />
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
  item: { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.61)' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  itemIcon: { marginRight: 8 },
  itemTitle: { fontSize: 18, marginBottom: 4 },
  itemSub: { opacity: 0.7 },
});
