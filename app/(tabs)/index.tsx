// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Logo from '../../components/Logo';

// Only import these for web background
const isWeb = Platform.OS === 'web';

const { height: H0, width: W0 } = Dimensions.get('window');

type Section = {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  image: string;
};

// CDN configuration - using your provided domain
const CDN_BASE_URL = 'https://idoxe6s.sufydely.com';
const IMAGE_VERSION = 'v1';

// ---- Content ----
const SECTIONS: Section[] = [
  {
    id: 'hero',
    eyebrow: 'Meet your AI twin',
    title: 'VirtualMe — in your own voice.',
    description:
      "Your personal AI that speaks like you, remembers the right things, and helps the people who matter most. VirtualMe syncs with your calendar and understands your location context to keep you on track—no panic, no spam, just calm, useful help.",
    image: `${CDN_BASE_URL}/Logo.png?version=${IMAGE_VERSION}`,
  },
  {
    id: 'voice-orb',
    eyebrow: 'Reactive UI',
    title: 'Live Voice Orb',
    description:
      'A real-time 3D voice orb that breathes with your speech. It listens with low-latency mic metering, visualizes energy and cadence, and makes the whole experience feel alive. Privacy-first: audio metering is used to animate locally before anything is processed.',
    image: `${CDN_BASE_URL}/orb.png?version=${IMAGE_VERSION}`,
  },
  {
    id: 'voice-clone',
    eyebrow: 'Ethical cloning',
    title: 'Your Voice, Authenticated',
    description:
      'Create a natural, safe voice clone in minutes. Multilingual output (English, Hindi, Urdu) with consent gates and clear labeling so it\'s never misleading. Great for hands-free replies, reminders, and sharing updates with family in the voice they trust.',
    image: `${CDN_BASE_URL}/Voice-Clone.png?version=${IMAGE_VERSION}`,
  },
  {
    id: 'context',
    eyebrow: 'Context-aware help',
    title: 'Real-time Updates + Family Lobby',
    description:
      'VirtualMe reads your day: calendar + location signals → smart nudges ("leave in 5 for your meeting") and lightweight statuses ("grabbing lunch, back at 1:30"). Invite close family to a private lobby where they can speak with your AI twin—then receive a clean email summary of what they asked and what was shared.',
    image: `${CDN_BASE_URL}/RU.png?version=${IMAGE_VERSION}`,
  },
];

const SCROLL_HINT = '▼';
const AnimatedView = Animated.createAnimatedComponent(View);

// Define the type for imagesLoaded state
type ImagesLoadedState = {
  [key: string]: boolean;
};

// Sound Wave Loader Component
const SoundWaveLoader = () => {
  const bar1Anim = useRef(new Animated.Value(0)).current;
  const bar2Anim = useRef(new Animated.Value(0)).current;
  const bar3Anim = useRef(new Animated.Value(0)).current;
  const bar4Anim = useRef(new Animated.Value(0)).current;
  const bar5Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create a staggered animation for the sound bars
    const createAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start all animations
    createAnimation(bar1Anim, 0).start();
    createAnimation(bar2Anim, 100).start();
    createAnimation(bar3Anim, 200).start();
    createAnimation(bar4Anim, 300).start();
    createAnimation(bar5Anim, 400).start();

    // Clean up on unmount
    return () => {
      bar1Anim.stopAnimation();
      bar2Anim.stopAnimation();
      bar3Anim.stopAnimation();
      bar4Anim.stopAnimation();
      bar5Anim.stopAnimation();
    };
  }, []);

  return (
    <View style={styles.soundWaveContainer}>
      <Animated.View 
        style={[
          styles.soundBar, 
          styles.soundBar1, 
          { 
            transform: [{ 
              scaleY: bar1Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1.2]
              }) 
            }] 
          }] 
        } 
      />
      <Animated.View 
        style={[
          styles.soundBar, 
          styles.soundBar2, 
          { 
            transform: [{ 
              scaleY: bar2Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1.5]
              }) 
            }] 
          }] 
        } 
      />
      <Animated.View 
        style={[
          styles.soundBar, 
          styles.soundBar3, 
          { 
            transform: [{ 
              scaleY: bar3Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1.7]
              }) 
            }] 
          }] 
        } 
      />
      <Animated.View 
        style={[
          styles.soundBar, 
          styles.soundBar4, 
          { 
            transform: [{ 
              scaleY: bar4Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1.5]
              }) 
            }] 
          }] 
        } 
      />
      <Animated.View 
        style={[
          styles.soundBar, 
          styles.soundBar5, 
          { 
            transform: [{ 
              scaleY: bar5Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1.2]
              }) 
            }] 
          }] 
        } 
      />
    </View>
  );
};

// --- VANTA CELLS BACKGROUND FOR WEB ---
declare global {
  // eslint-disable-next-line no-var
  interface Window {
    VANTA?: any;
  }
}

function VantaBackground() {
  const vantaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isWeb) return;
    // Only run on web
    let vantaEffect: any = null;

    // Dynamically load scripts if not present
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

    let cancelled = false;

    async function setupVanta() {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.cells.min.js');
        if (typeof window !== 'undefined' && window.VANTA && window.VANTA.CELLS && vantaRef.current) {
          vantaEffect = window.VANTA.CELLS({
            el: vantaRef.current,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            scale: 1.0,
            color1: 0x202222,
            color2: 0x344a86,
            size: 3.7,
            speed: 2.5,
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('VANTA background failed to load', e);
      }
    }

    setupVanta();

    return () => {
      cancelled = true;
      if (vantaEffect && typeof vantaEffect.destroy === 'function') {
        vantaEffect.destroy();
      }
    };
  }, []);

  // The background div is absolutely positioned and covers the whole screen
  return (
    <div
      ref={vantaRef}
      id="vanta-bg"
      style={{
        position: 'fixed',
        zIndex: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        background: '#0B0F14',
      }}
    />
  );
}

export default function LandingScreen() {
  const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = useWindowDimensions();
  const pageH = Math.max(SCREEN_HEIGHT, H0, 1);

  // We'll use a ref to store the last scroll position for mouse/trackpad
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Which section index are we near?
  const [active, setActive] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState<ImagesLoadedState>({});
  const [isAppReady, setIsAppReady] = useState(false);

  // --- Fix: Use onScroll to update Animated.Value for all input types (touch, mouse, trackpad) ---
  // This ensures the animation always works, regardless of input device.
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.setValue(y); // This triggers animation for all input types
    const idx = pageH > 0 ? Math.round(y / pageH) : 0;
    if (idx !== active) setActive(idx);
  };

  // Only mount current & neighbors for perf
  const mounted = useMemo(() => {
    const m = new Set<number>();
    m.add(active);
    if (active - 1 >= 0) m.add(active - 1);
    if (active + 1 < SECTIONS.length) m.add(active + 1);
    return m;
  }, [active]);

  const isTablet = SCREEN_WIDTH >= 640;
  const isMobile = SCREEN_WIDTH < 480;

  // --- NEW: Detect "long" screens (portrait, tall, or very narrow) ---
  // If height is much greater than width, and width is not very large, treat as "long"
  // You can tweak the ratio as needed for your app
  const isLongScreen = SCREEN_HEIGHT / SCREEN_WIDTH > 1.25 && SCREEN_WIDTH < 700;

  // Preload images
  useEffect(() => {
    const preloadImages = async () => {
      try {
        await Promise.all(
          SECTIONS.map(s => 
            ExpoImage.prefetch(s.image).catch(e => console.warn('Prefetch failed:', e))
          )
        );
        
        // Mark all images as loaded
        const loadedState: ImagesLoadedState = {};
        SECTIONS.forEach(s => {
          loadedState[s.id] = true;
        });
        setImagesLoaded(loadedState);
        setIsAppReady(true);
      } catch (error) {
        console.error('Error preloading images:', error);
        setIsAppReady(true); // Still show the app even if images fail to load
      }
    };

    preloadImages();
  }, []);

  // Handle image load errors with retry logic
  const handleImageError = (id: string, url: string) => {
    console.warn(`Image failed to load: ${id}`);
    
    // Mark as not loaded
    setImagesLoaded(prev => ({ ...prev, [id]: false }));
    
    // Try to reload the image after a delay
    setTimeout(() => {
      ExpoImage.prefetch(url)
        .then(() => {
          setImagesLoaded(prev => ({ ...prev, [id]: true }));
        })
        .catch(e => console.warn('Retry prefetch failed:', e));
    }, 2000);
  };

  // Show loading screen until app is ready
  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <SoundWaveLoader />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#0B0F14' }]}>
      {/* VANTA CELLS background for web only */}
      {isWeb && <VantaBackground />}

      {/* Dot pager */}
      <View style={[styles.pager, isMobile && { top: 16, right: 10, gap: 6 }]}>
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

      <ScrollView
        ref={scrollViewRef}
        pagingEnabled
        snapToInterval={pageH}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ height: pageH * SECTIONS.length }}
        style={styles.scrollView}
        // Enable wheel events for web (for mouse/trackpad scroll)
        // This is a no-op on native, but on web it ensures wheel events are handled
        // @ts-ignore
        onWheel={Platform.OS === 'web' ? (e: any) => {
          if (scrollViewRef.current && e.deltaY) {
            // Let RN handle the scroll, but we could force update scrollY here if needed
            // (Not needed if onScroll is working)
          }
        } : undefined}
      >
        {SECTIONS.map((s, idx) => {
          const inView = mounted.has(idx);

          // Section entrance anims
          const base = idx * pageH;
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

          // Parallax on image
          const imgTranslate = progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-28, 0, 28],
          });

          // Layout
          const isWide = isTablet && !isLongScreen;
          const reverse = isWide && idx % 2 === 1;

          // Image sizing
          const phoneMaxW = isWide ? SCREEN_WIDTH * 0.44 : SCREEN_WIDTH * 0.86;
          const phoneW = Math.min(phoneMaxW, 640);
          const phoneAR = 19.5 / 9;
          const phoneH = phoneW * phoneAR;

          // --- NEW: Disable image on long screens where text and image can't fit side by side ---
          // If isLongScreen, do not render the image at all
          const showImage = !isLongScreen;

          // --- Custom: For hero section, show Logo component instead of image ---
          const isHero = s.id === 'hero';

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
                  // If image is hidden, center text card more
                  alignItems: showImage ? 'center' : 'stretch',
                  justifyContent: 'center',
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
                    alignSelf: showImage ? 'auto' : 'center',
                  },
                ]}
              >
                {!!s.eyebrow && (
                  <Text style={[styles.eyebrow, isMobile && { fontSize: 12, marginBottom: 6 }]}>
                    {s.eyebrow}
                  </Text>
                )}
                <Text style={[styles.title, isMobile && { fontSize: 22, lineHeight: 28, marginBottom: 7 }]}>
                  {s.title}
                </Text>
                <Text style={[styles.desc, isMobile && { fontSize: 14.5, lineHeight: 20 }]}>
                  {s.description}
                </Text>

                {idx === 0 && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.cta, isMobile && { marginTop: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }]}
                  >
                    <Text style={[styles.ctaText, isMobile && { fontSize: 13 }]}>Try the Voice Orb</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>

              {/* Image container */}
              {showImage && (
                <AnimatedView
                  style={{
                    width: phoneW,
                    height: phoneH,
                    opacity: inView ? 1 : 0,
                    transform: [{ translateY: imgTranslate }, { scale: isWide ? 1 : 0.98 }],
                    marginTop: isMobile ? 8 : 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {inView && (
                    <>
                      {isHero ? (
                        // Render Logo component for hero section
                        <Logo style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <>
                          <ExpoImage
                            source={{ uri: s.image }}
                            contentFit="contain"
                            style={{ width: '100%', height: '100%' }}
                            transition={250}
                            cachePolicy="disk"
                            onError={() => handleImageError(s.id, s.image)}
                            onLoad={() => setImagesLoaded(prev => ({ ...prev, [s.id]: true }))}
                          />
                          {/* Loading placeholder */}
                          {!imagesLoaded[s.id] && (
                            <View style={[styles.placeholder, { width: '100%', height: '100%' }]}>
                              <Text style={styles.placeholderText}>Loading image...</Text>
                            </View>
                          )}
                        </>
                      )}
                    </>
                  )}
                </AnimatedView>
              )}
            </View>
          );
        })}
      </ScrollView>

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
  root: { 
    flex: 1,
    overflow: 'hidden',
    // The background is handled by VantaBackground for web, so no need to set backgroundColor here
  },
  scrollView: {
    flex: 1,
  },
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
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#8AA2FF',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0F14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  soundBar: {
    width: 4,
    backgroundColor: '#8AA2FF',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  soundBar1: {
    height: 10,
  },
  soundBar2: {
    height: 15,
  },
  soundBar3: {
    height: 20,
  },
  soundBar4: {
    height: 15,
  },
  soundBar5: {
    height: 10,
  },
});