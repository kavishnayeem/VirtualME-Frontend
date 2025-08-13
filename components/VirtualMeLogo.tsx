import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function VirtualMeLogo() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Virtual</Text>
      <Text style={[styles.brand, styles.brandAccent]}>Me</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  brand: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandAccent: {
    textDecorationLine: 'none',
  },
}); 