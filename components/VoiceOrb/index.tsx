import React from 'react';
import { Platform } from 'react-native';

type Props = { intensity?: number };

let Web3DOrb: React.ComponentType<Props> | undefined;
let Mobile3DOrb: React.ComponentType<Props> | undefined;

if (Platform.OS === 'web') {
  try {
    Web3DOrb = require('./Web3DOrb.web').default as React.ComponentType<Props>;
  } catch (e) {
    Web3DOrb = undefined;
  }
} else {
  try {
    Mobile3DOrb = require('./Mobile3DOrb.native').default as React.ComponentType<Props>;
  } catch (e) {
    Mobile3DOrb = undefined;
  }
}

const VoiceOrb3D: React.FC<Props> = (props) => {
  if (Platform.OS === 'web') {
    if (Web3DOrb) {
      return <Web3DOrb {...props} />;
    }
    return null;
  }
  if (Mobile3DOrb) {
    return <Mobile3DOrb {...props} />;
  }
  return null;
};

export default VoiceOrb3D;
