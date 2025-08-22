import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';

export default function AboutMeScreen() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText type="title">About Me</ThemedText>
      <ThemedText>Coming soon</ThemedText>
    </ThemedView>
  );
}
