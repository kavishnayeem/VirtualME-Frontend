// app/(tabs)/menu/index.tsx
import React, { useRef, useEffect } from 'react';
import { Pressable, StyleSheet, View, Platform, Animated, Dimensions } from 'react-native';
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

// --- Animated Creative Moving Background for Mobile ---
const isWeb = Platform.OS === 'web';

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function AnimatedMobileBackground() {
  // Only render on mobile
  if (isWeb) return null;

  // We'll animate a set of colored, blurred, glowing orbs and lines moving in different directions
  const { width, height } = Dimensions.get('window');

  // Orbs: more, with different sizes, colors, and movement patterns
  const orbConfigs = Array.from({ length: 7 }).map((_, i) => ({
    size: randomBetween(70, 180),
    color: [
      'rgba(78,142,150,0.18)',
      'rgba(255,255,255,0.10)',
      'rgba(78,142,150,0.13)',
      'rgba(255,255,255,0.08)',
      'rgba(0,255,200,0.10)',
      'rgba(255,0,200,0.10)',
      'rgba(0,100,255,0.10)',
    ][i % 7],
    left: randomBetween(0, width * 0.8),
    top: randomBetween(0, height * 0.8),
    duration: randomBetween(6000, 12000),
    delay: randomBetween(0, 2000),
    direction: Math.random() > 0.5 ? 1 : -1,
    blur: randomBetween(10, 30),
    glow: i % 2 === 0,
  }));

  // Lines: animated, semi-transparent, moving diagonally
  const lineConfigs = Array.from({ length: 4 }).map((_, i) => ({
    width: randomBetween(width * 0.5, width * 0.9),
    height: 2 + Math.floor(Math.random() * 2),
    color: [
      'rgba(78,142,150,0.12)',
      'rgba(255,255,255,0.09)',
      'rgba(0,255,200,0.08)',
      'rgba(255,0,200,0.08)',
    ][i % 4],
    left: randomBetween(0, width * 0.5),
    top: randomBetween(0, height * 0.9),
    duration: randomBetween(7000, 14000),
    delay: randomBetween(0, 2000),
    angle: randomBetween(-30, 30),
    direction: Math.random() > 0.5 ? 1 : -1,
  }));

  // Each orb and line gets its own Animated.Value
  const orbAnims = useRef(orbConfigs.map(() => new Animated.Value(0))).current;
  const lineAnims = useRef(lineConfigs.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    orbAnims.forEach((anim, i) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: orbConfigs[i].duration,
            delay: orbConfigs[i].delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: orbConfigs[i].duration,
            delay: 0,
            useNativeDriver: true,
          }),
        ]).start(() => animate());
      };
      animate();
    });
    lineAnims.forEach((anim, i) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: lineConfigs[i].duration,
            delay: lineConfigs[i].delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: lineConfigs[i].duration,
            delay: 0,
            useNativeDriver: true,
          }),
        ]).start(() => animate());
      };
      animate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} collapsable={false}>
      {/* Orbs */}
      {orbConfigs.map((c, i) => {
        // Animate vertical and horizontal movement, and a subtle scale pulse
        const translateY = orbAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, c.direction * c.size * 0.4],
        });
        const translateX = orbAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -c.direction * c.size * 0.3],
        });
        const scale = orbAnims[i].interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.08, 1],
        });
        return (
          <Animated.View
            key={'orb-' + i}
            style={{
              position: 'absolute',
              left: c.left,
              top: c.top,
              width: c.size,
              height: c.size,
              borderRadius: c.size / 2,
              backgroundColor: c.color,
              opacity: 1,
              transform: [{ translateY }, { translateX }, { scale }],
              // Add shadow/glow for some orbs
              shadowColor: c.glow ? '#4e8e96' : undefined,
              shadowOffset: c.glow ? { width: 0, height: 0 } : undefined,
              shadowOpacity: c.glow ? 0.5 : 0,
              shadowRadius: c.glow ? 18 : 0,
              // Blur effect (Android/iOS only, not web)
              ...(Platform.OS !== 'web'
                ? { 
                    // @ts-ignore
                    filter: `blur(${c.blur}px)` // ignored on native, but for completeness
                  }
                : {}),
            }}
          />
        );
      })}
      {/* Lines */}
      {lineConfigs.map((l, i) => {
        // Animate diagonal movement
        const translate = lineAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, l.direction * 60],
        });
        return (
          <Animated.View
            key={'line-' + i}
            style={{
              position: 'absolute',
              left: l.left,
              top: l.top,
              width: l.width,
              height: l.height,
              backgroundColor: l.color,
              borderRadius: 2,
              opacity: 0.7,
              transform: [
                { translateX: translate },
                { translateY: translate },
                { rotateZ: `${l.angle}deg` },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

// --- VANTA TOPOLOGY BACKGROUND FOR WEB ---
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
      <AnimatedMobileBackground />
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
  container: { flex: 1, padding: 20, gap: 12, backgroundColor: '#000' },
  title: { textAlign: 'center', marginTop: 16, marginBottom: 12 },
  list: { gap: 12 },
  item: { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.61)' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  itemIcon: { marginRight: 8 },
  itemTitle: { fontSize: 18, marginBottom: 4 },
  itemSub: { opacity: 0.7 },
});
