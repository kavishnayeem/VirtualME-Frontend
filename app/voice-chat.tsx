// app/voice-chat.tsx
import { StyleSheet, View } from 'react-native';
import React, { useState } from 'react';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import VoiceOrb from '../components/VoiceOrb';
import PersonaCenter from '../components/PersonaCenter';
import { usePersonaTarget } from '../hooks/usePersonaTarget';
import { Pressable } from 'react-native';
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
  const [open, setOpen] = useState(false);
  const { target } = usePersonaTarget();
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', paddingTop: 16 }}>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: '#171717',
          borderWidth: 1,
          borderColor: '#2a2a2a',
          marginBottom: 10,
        }}
      >
        <ThemedText style={{ color: '#ddd', fontWeight: '700' }}>
          {target?.name || target?.email
            ? `Acting as: ${target.name ?? target.email}`
            : 'Choose persona'}
        </ThemedText>
      </Pressable>

      <VoiceOrb intensity={0.6} />

      <PersonaCenter visible={open} onClose={() => setOpen(false)} />
    </ThemedView>
  );
}
