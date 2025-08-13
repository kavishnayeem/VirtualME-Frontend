// app/voice.tsx
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import VoiceOrb from '../../components/VoiceOrb';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    justifyContent: "space-evenly",
    alignItems: 'center',
   paddingTop : "10%"
  },
  title: { marginBottom: 10, textAlign: 'center' },
  orbWrapper: {
    flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', marginVertical: 20,
  },
  infoText: { textAlign: 'center', maxWidth: 300, marginBottom: 20 },
});

export default function VoiceScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Voice</ThemedText>
      <View style={styles.orbWrapper}>
        <VoiceOrb intensity={0.8} />
      </View>
      <ThemedText style={styles.infoText}>
        Speak to see text below. Tap the orb to start/stop.
      </ThemedText>
    </ThemedView>
  );
}
