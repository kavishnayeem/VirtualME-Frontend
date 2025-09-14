import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';

const CONTACTS = {
  email: 'kavishnayeem141@gmail.com',
  github: 'https://github.com/kavishnayeem',
  linkedin: 'https://www.linkedin.com/in/kavish-nayeem/',
};

const NAME = 'Kavish Nayeem';
const ROLE = 'MSCS @ TAMU-CC · Voice AI & Full-Stack Engineer';
const SHORT_TAG =
  'I build voice-first products end-to-end — real-time STT → LLM → TTS, clean APIs, and shipping that feels fast and polished.';

/** Native-friendly typewriter (works in Expo Go) */
function useTypewriter(text: string, speedMs = 80) {
  const [out, setOut] = useState('');
  const idxRef = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const tick = () => {
      if (!alive.current) return;
      idxRef.current += 1;
      setOut(text.slice(0, idxRef.current));
      if (idxRef.current < text.length) {
        setTimeout(tick, speedMs);
      }
    };
    const id = setTimeout(tick, speedMs);
    return () => {
      alive.current = false;
      clearTimeout(id);
    };
  }, [text, speedMs]);

  return out;
}

export default function AboutMeScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 680;
  const contentMax = Math.min(1040, Math.max(340, Math.floor(width * 0.94)));

  // Responsive tokens
  const nameSize = Math.max(30, Math.min(64, Math.floor(width * 0.08)));
  const roleSize = isNarrow ? 14 : 15.5;
  const tagSize = isNarrow ? 14.5 : 16;
  const bodySize = isNarrow ? 14.5 : 16;
  const cardRadius = isNarrow ? 16 : 18;

  // Typewriter + blinking cursor
  const typedName = useTypewriter(NAME, 75);
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, [cursorOpacity]);

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <ThemedView style={[styles.root, Platform.OS === 'web' ? { minHeight: '100vh' as any } : null]}>
      <SafeAreaView style={{ flex: 1, alignSelf: 'stretch' }}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: isNarrow ? 28 : 44, paddingBottom: 40, paddingHorizontal: isNarrow ? 16 : 20 },
          ]}
        >
          {/* HERO */}
          <View style={[styles.heroShell, { maxWidth: contentMax, borderRadius: cardRadius + 8 }]}>
            <View style={styles.ambient} />
            <View style={[styles.hero, { borderRadius: cardRadius + 8 }]}>
              <View style={styles.nameRow}>
                <ThemedText
                  style={[
                    styles.name,
                    {
                      fontSize: nameSize,
                      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as any,
                    },
                  ]}
                >
                  {typedName}
                </ThemedText>
                <Animated.Text
                  style={[
                    styles.cursor,
                    {
                      fontSize: nameSize,
                      opacity: cursorOpacity,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    },
                  ]}
                >
                  |
                </Animated.Text>
              </View>

              <ThemedText style={[styles.role, { fontSize: roleSize }]}>{ROLE}</ThemedText>
              <ThemedText
                style={[
                  styles.tag,
                  { fontSize: tagSize, lineHeight: Math.ceil(tagSize * 1.5), maxWidth: contentMax * 0.9 },
                ]}
              >
                {SHORT_TAG}
              </ThemedText>
              <ThemedText style={styles.footer}>Let’s build something users can’t put down.</ThemedText>
            </View>
          </View>

          {/* BIO / SUMMARY */}
          <View
            style={[
              styles.card,
              { maxWidth: contentMax, borderRadius: cardRadius, paddingHorizontal: 18, paddingVertical: 18 },
            ]}
          >
            <ThemedText style={[styles.sectionTitle, { fontSize: isNarrow ? 16 : 17 }]}>About</ThemedText>
            <ThemedText style={[styles.body, { fontSize: bodySize }]}>
              I’m a dynamic, results-driven engineer with a background spanning full-stack development, cloud, and AI/ML.
              I’ve led cross-functional work that shipped to users, won an internal hackathon at Tyler Technologies, and
              topped project rankings in my master’s program. I care about measurable UX wins and systems that are fast,
              observable, and sane to maintain.
            </ThemedText>
          </View>

          {/* HIGHLIGHTS GRID */}
          <View style={[styles.grid, { maxWidth: contentMax }]}>
            <Highlight
              title="Tyler Technologies — SDE Intern"
              bullets={[
                'Centralized logging for .NET apps with Serilog + AWS CloudWatch',
                'Automated failed-mail resend via Amazon SES (SOAP microservice)',
                'Led JiraBotOps — hackathon winning automation for Dependabot alerts',
              ]}
            />
            <Highlight
              title="Graduate Assistant (Web Dev)"
              bullets={[
                'PERN full-stack app analyzing 500+ interactive student surveys',
                'Automated LinkedIn insights (n8n/Puppeteer/Cheerio) to enhance engagement',
              ]}
            />
            <Highlight
              title="Research Assistant — TEEs & AI/ML"
              bullets={[
                'Worked with Keystone / Multizone in Docker for secure AI/ML execution',
                'Designed multi-zone isolation; explored perf & scalability tradeoffs',
              ]}
            />
          </View>

          {/* PROJECTS */}
          <View
            style={[
              styles.card,
              { maxWidth: contentMax, borderRadius: cardRadius, paddingHorizontal: 18, paddingVertical: 18 },
            ]}
          >
            <ThemedText style={[styles.sectionTitle, { fontSize: isNarrow ? 16 : 17 }]}>Selected Projects</ThemedText>

            <Project
              name="VirtualMe — Cross-Platform Voice Assistant"
              points={[
                'Real-time chat with AI personas & personalized voice cloning',
                'Groq STT/Chat + ElevenLabs TTS; modular microservices with Redis',
                'Google OAuth + profile-driven personalization across devices',
              ]}
            />

            <View style={styles.divider} />

            <Project
              name="JiraBotOps — AWS Lambda Automation (Hackathon Winner)"
              points={[
                'Automated Jira ticket creation/closure for critical Dependabot alerts',
                'Integrated thousands of repos via API Gateway + GitOps for fast deploys',
              ]}
            />

            <View style={styles.divider} />

            <Project
              name="PhishPatrol — LLM Guardian"
              points={[
                'DeBERTa (200M) fine-tuned; ONNX for fast browser-side inference',
                '99.2% accuracy; FastAPI backend + WebAssembly frontend integration',
              ]}
            />
          </View>

          {/* SKILLS & LANGUAGES */}
          <View style={[styles.card, { maxWidth: contentMax, borderRadius: cardRadius, padding: 18 }]}>
            <ThemedText style={[styles.sectionTitle, { fontSize: isNarrow ? 16 : 17 }]}>
              What I Work With
            </ThemedText>
            <View style={styles.pillsWrap}>
              {[
                'React Native', 'TypeScript', 'Node/Express', '.NET', 'AWS', 'Redis', 'PostgreSQL',
                'PyTorch', 'Transformers', 'ONNX', 'RAG', 'CI/CD', 'GitOps', 'Docker', 'Kubernetes',
              ].map((s) => (
                <Pill key={s} label={s} />
              ))}
            </View>

            <ThemedText style={[styles.sectionTitle, { marginTop: 14, fontSize: isNarrow ? 16 : 17 }]}>
              Languages
            </ThemedText>
            <View style={styles.pillsWrap}>
              <Pill label="English — Full Professional" />
              <Pill label="Hindi — Native/Bilingual" />
              <Pill label="Spanish — Limited Working" />
            </View>
          </View>

          {/* CONTACT */}
          <View
            style={[
              styles.contactRow,
              {
                maxWidth: contentMax,
                flexDirection: isNarrow ? 'column' : 'row',
                gap: isNarrow ? 10 : 12,
                alignItems: isNarrow ? 'stretch' : 'center',
              },
            ]}
          >
            <ContactButton label="✉️ Email" onPress={() => open(`mailto:${CONTACTS.email}`)} />
            <ContactButton label="💼 LinkedIn" onPress={() => open(CONTACTS.linkedin)} />
            <ContactButton label="🐙 GitHub" onPress={() => open(CONTACTS.github)} />
          </View>

          
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* — Reusable bits — */

function Highlight({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <View style={styles.highlight}>
      <ThemedText style={styles.highlightTitle}>{title}</ThemedText>
      {bullets.map((b, i) => (
        <ThemedText style={styles.highlightLine} key={i}>
          • {b}
        </ThemedText>
      ))}
    </View>
  );
}

function Project({ name, points }: { name: string; points: string[] }) {
  return (
    <View>
      <ThemedText style={styles.projectName}>{name}</ThemedText>
      {points.map((p, i) => (
        <ThemedText style={styles.projectLine} key={i}>
          • {p}
        </ThemedText>
      ))}
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <ThemedText style={styles.pillText}>{label}</ThemedText>
    </View>
  );
}

function ContactButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.linkBtn, Platform.OS === 'web' ? styles.webHover : null]} onPress={onPress}>
      <ThemedText style={styles.linkText}>{label}</ThemedText>
    </Pressable>
  );
}

/* — Styles — */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: {
    alignItems: 'center',
    gap: 18,
  },

  /* HERO */
  heroShell: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  ambient: {
    height: 10,
    width: '100%',
    backgroundColor: 'rgba(150,120,255,0.18)',
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap', // prevents truncation on web
  },
  name: {
    letterSpacing: 0.5,
  },
  cursor: {
    marginLeft: 2,
  },
  role: {
    marginTop: 6,
    opacity: 0.85,
  },
  tag: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.95,
  },

  /* CARDS & GRID */
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    backgroundColor: 'rgba(127,127,127,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    lineHeight: 22,
    opacity: 0.95,
  },

  grid: {
    width: '100%',
    gap: 12,
  },
  highlight: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.22)',
    backgroundColor: 'rgba(127,127,127,0.05)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  highlightTitle: {
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 15.5,
  },
  highlightLine: {
    opacity: 0.95,
    fontSize: 14.5,
    lineHeight: 21,
  },

  projectName: {
    fontWeight: '700',
    fontSize: 15.5,
    marginBottom: 6,
  },
  projectLine: {
    fontSize: 14.5,
    lineHeight: 21,
    opacity: 0.95,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.22)',
    marginVertical: 14,
  },

  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    backgroundColor: 'rgba(127,127,127,0.08)',
  },
  pillText: {
    fontWeight: '600',
    fontSize: 13.5,
    letterSpacing: 0.2,
  },

  /* CONTACT */
  contactRow: {
    width: '100%',
    justifyContent: 'center',
  },
  linkBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    backgroundColor: 'rgba(127,127,127,0.06)',
    alignItems: 'center',
  },
  webHover: {
    cursor: 'pointer' as any,
  },
  linkText: {
    fontWeight: '700',
    letterSpacing: 0.2,
    fontSize: 15,
  },

  footer: {
    opacity: 0.7,
    fontSize: 13,
    textAlign: 'center',
  },
});
