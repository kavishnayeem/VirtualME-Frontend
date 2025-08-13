import { StyleSheet, View } from 'react-native';

import ParallaxScrollView from '../../components/ParallaxScrollView';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { VirtualMeLogo } from '../../components/VirtualMeLogo';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#0B0F14', dark: '#0B0F14' }}
      headerImage={<View />}
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={styles.sleekTitle}
        >
          Welcome to
        </ThemedText>
        <VirtualMeLogo />
      </ThemedView>
      <ThemedText style={styles.infoText}>
        Tap <ThemedText style={styles.voiceTabText}>Voice</ThemedText> tab to try the voice orb.
      </ThemedText>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  sleekTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 32,
    letterSpacing: 0.5,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  infoText: {
    alignSelf: 'center',
    textAlign: 'center',
    width: '100%',
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 17,
    color: '#B0B8C1',
    marginTop: 8,
    letterSpacing: 0.1,
  },
  voiceTabText: {
    fontWeight: '700',
    color: '#4F8EF7',
    fontSize: 17,
    fontFamily: 'System',
  },
});
