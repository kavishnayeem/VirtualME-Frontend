
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Platform,
} from 'react-native';

const { height: H0, width: W0 } = Dimensions.get('window');

type Section = {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
};

// If you want to use remote images for production reliability, use the following pattern:
// image: { uri: 'https://virtualme.expo.app/assets/images/Logo.png' }
// But if you want to use local images, make sure they are present in the correct path and committed.

const SECTIONS: Section[] = [
  {
    id: 'hero',
    eyebrow: 'Meet your AI twin',
    title: 'VirtualMe — in your own voice.',
    description:
      "Your personal AI that speaks like you, remembers the right things, and helps the people who matter most. VirtualMe syncs with your calendar and understands your location context to keep you on track—no panic, no spam, just calm, useful help.",
    image: { uri: 'https://i.ibb.co/1fkZt1ky/Logo.png' },
    // For remote: image: { uri: 'https://virtualme.expo.app/assets/images/Logo.png' },
  },
  {
    id: 'voice-orb',
    eyebrow: 'Reactive UI',
    title: 'Live Voice Orb',
    description:
      "A real-time 3D voice orb that breathes with your speech. It listens with low-latency mic metering, visualizes energy and cadence, and makes the whole experience feel alive. Privacy-first: audio metering is used to animate locally before anything is processed.",
    image: { uri: 'https://i.ibb.co/HDhYHtXw/orb.png' },
    // For remote: image: { uri: 'https://virtualme.expo.app/assets/images/orb.png' },
  },
  {
    id: 'voice-clone',
    eyebrow: 'Ethical cloning',
    title: 'Your Voice, Authenticated',
    description:
      "Create a natural, safe voice clone in minutes. Multilingual output (English, Hindi, Urdu) with consent gates and clear labeling so it’s never misleading. Great for hands-free replies, reminders, and sharing updates with family in the voice they trust.",
    image: { uri: 'https://i.ibb.co/fY1WVCmT/Voice-Clone.png' },
    // For remote: image: { uri: 'https://virtualme.expo.app/assets/images/Voice-Clone.png' },
  },
  {
    id: 'context',
    eyebrow: 'Context-aware help',
    title: 'Real-time Updates + Family Lobby',
    description:
      "VirtualMe reads your day: calendar + location signals → smart nudges (“leave in 5 for your meeting”) and lightweight statuses (“grabbing lunch, back at 1:30”). Invite close family to a private lobby where they can speak with your AI twin—then receive a clean email summary of what they asked and what was shared.",
    image: { uri: 'https://i.ibb.co/h1YwZXns/RTU.png' },
    // For remote: image: { uri: 'https://virtualme.expo.app/assets/images/RTU.png' },
  },
];

const SCROLL_HINT = '▼';

export default function LandingScreen() {
  const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = useWindowDimensions();
  // Prevent division by zero: fallback to 1 if both SCREEN_HEIGHT and H0 are 0
  const pageH = Math.max(SCREEN_HEIGHT, H0, 1);
  const pageW = Math.max(SCREEN_WIDTH, W0, 1);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Which section index are we near?
  const [active, setActive] = useState(0);
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e) => {
        const y = (e as { nativeEvent: { contentOffset: { y: number } } }).nativeEvent.contentOffset.y;
        // Prevent division by zero
        const idx = pageH > 0 ? Math.round(y / pageH) : 0;
        if (idx !== active) setActive(idx);
      },
    }
  );

  // Only mount current & neighbors for perf
  const mounted = useMemo(() => {
    const m = new Set<number>();
    m.add(active);
    if (active - 1 >= 0) m.add(active - 1);
    if (active + 1 < SECTIONS.length) m.add(active + 1);
    return m;
  }, [active]);

  // Responsive breakpoints
  const isTablet = SCREEN_WIDTH >= 640;
  const isMobile = SCREEN_WIDTH < 480;

  return (
    <View style={[styles.root, { backgroundColor: '#0B0F14' }]}>
      {/* Dot pager */}
      <View style={[
        styles.pager,
        isMobile && { top: 16, right: 10, gap: 6 }
      ]}>
        {SECTIONS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              isMobile && { width: 7, height: 7, borderRadius: 7, marginVertical: 2 },
              { opacity: i === active ? 1 : 0.4, transform: [{ scale: i === active ? 1 : 0.85 }] },
            ]}
          />
        ))}
      </View>

      <Animated.ScrollView
        pagingEnabled
        snapToInterval={pageH}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ height: pageH * SECTIONS.length }}
      >
        {SECTIONS.map((s, idx) => {
          const inView = mounted.has(idx);

          // Section entrance
          const base = idx * pageH;
          // Prevent division by zero in Animated.divide
          const safePageH = pageH > 0 ? pageH : 1;
          const progress = Animated.divide(
            Animated.subtract(scrollY, base),
            new Animated.Value(safePageH)
          );
          const cardTranslate = progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [40, 0, -40],
          });
          const cardOpacity = progress.interpolate({
            inputRange: [-0.35, 0, 0.35],
            outputRange: [0, 1, 0],
          });

          // Subtle parallax on image
          const imgTranslate = progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-28, 0, 28],
          });
          const isWide = isTablet;
          const reverse = isWide && idx % 2 === 1;

          return (
            <View
              key={s.id}
              style={[
                styles.page,
                {
                  height: pageH,
                  flexDirection: isWide ? (reverse ? 'row-reverse' : 'row') : 'column',
                  paddingHorizontal: isMobile ? 10 : 20,
                  paddingVertical: isMobile ? 16 : 28,
                  gap: isMobile ? 14 : 22,
                },
              ]}
            >
              {/* Text card */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardOpacity,
                    transform: [{ translateY: cardTranslate }],
                    maxWidth: isWide ? '48%' : '98%',
                    paddingHorizontal: isMobile ? 12 : 22,
                    paddingVertical: isMobile ? 14 : 22,
                  },
                ]}
              >
                {!!s.eyebrow && <Text style={[styles.eyebrow, isMobile && { fontSize: 12, marginBottom: 6 }]}>{s.eyebrow}</Text>}
                <Text style={[styles.title, isMobile && { fontSize: 22, lineHeight: 28, marginBottom: 7 }]}>{s.title}</Text>
                <Text style={[styles.desc, isMobile && { fontSize: 14.5, lineHeight: 20 }]}>{s.description}</Text>

                {idx === 0 && (
                  <TouchableOpacity activeOpacity={0.85} style={[styles.cta, isMobile && { marginTop: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }]}>
                    <Text style={[styles.ctaText, isMobile && { fontSize: 13 }]}>Try the Voice Orb</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>

              {/* Image (lazy-mounted) */}
              <Animated.Image
                source={inView ? s.image : undefined}
                resizeMode="contain"
                accessibilityLabel={s.title}
                style={[
                  styles.phone,
                  {
                    transform: [{ translateY: imgTranslate }, { scale: isWide ? 1 : 0.98 }],
                    maxWidth: isWide ? '44%' : isMobile ? '98%' : '86%',
                    opacity: inView ? 1 : 0,
                    height: isMobile ? '38%' : '70%',
                    marginTop: isMobile ? 8 : 0,
                  },
                ]}
              />
            </View>
          );
        })}
      </Animated.ScrollView>

      {/* Scroll hint on first screen only */}
      {active === 0 && (
        <View style={[styles.hintWrap, isMobile && { bottom: 10 }]}>
          <Text style={[styles.hint, isMobile && { fontSize: 15 }]}>{SCROLL_HINT}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: {
    position: 'absolute',
    top: 28,
    right: 20,
    zIndex: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#8AA2FF',
    marginVertical: 3,
  },
  page: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },

  // “Glass card” (no blur dependency) – soft translucent box
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 40,
    shadowOpacity: 0.35,
  },
  eyebrow: {
    color: '#8AA2FF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#F3F6FF',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  desc: {
    color: '#C3CBDA',
    fontSize: 16.5,
    lineHeight: 25,
  },

  phone: {
    width: '100%',
    height: '70%',
  },

  cta: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#4F8EF7',
  },
  ctaText: {
    color: '#0B0F14',
    fontSize: 15,
    fontWeight: '800',
  },

  hintWrap: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  hint: {
    color: '#93A0B4',
    fontSize: 18,
    opacity: 0.9,
  },
});
