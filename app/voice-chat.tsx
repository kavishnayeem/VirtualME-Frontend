// app/voice-chat.tsx
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import VoiceOrb from '../components/VoiceOrb';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    justifyContent: "space-evenly",
    alignItems: 'center',
    
  },

  orbWrapper: {
    flex: 1, width: '100%', justifyContent: "center", alignItems: 'center',
  },
  infoText: { textAlign: 'center', maxWidth: 300, marginBottom: 20 },
});

export default function VoiceChatScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.orbWrapper}>
        <VoiceOrb intensity={0.8} />
      </View>
      <ThemedText style={styles.infoText}>
        Tap the orb to start/stop.
      </ThemedText>
    </ThemedView>
  );
}
