import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';

export default function VoiceCloneScreen() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText type="title">Voice Clone</ThemedText>
      <ThemedText>Coming soon…</ThemedText>
    </ThemedView>
  );
}
