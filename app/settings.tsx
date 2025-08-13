import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';

export default function SettingsScreen() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText type="title">Settings</ThemedText>
    </ThemedView>
  );
}
