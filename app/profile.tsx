import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';

export default function ProfileScreen() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText type="title">Profile</ThemedText>
    </ThemedView>
  );
}
