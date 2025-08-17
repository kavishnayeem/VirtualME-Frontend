import React from 'react';
import { Platform } from 'react-native';

type VoiceCloneProps = Record<string, any>;

let WebVoiceClone: React.ComponentType<VoiceCloneProps> | undefined;
let MobileVoiceClone: React.ComponentType<VoiceCloneProps> | undefined;

if (Platform.OS === 'web') {
  try {
    WebVoiceClone = require('./Web-voice-clone').default as React.ComponentType<VoiceCloneProps>;
  } catch (e) {
    WebVoiceClone = undefined;
  }
} else {
  try {
    MobileVoiceClone = require('./Mob-voice-clone').default as React.ComponentType<VoiceCloneProps>;
  } catch (e) {
    MobileVoiceClone = undefined;
  }
}

const VoiceClone: React.FC<VoiceCloneProps> = (props) => {
  if (Platform.OS === 'web') {
    if (WebVoiceClone) {
      return <WebVoiceClone {...props} />;
    }
    return null;
  }
  if (MobileVoiceClone) {
    return <MobileVoiceClone {...props} />;
  }
  return null;
};

export default VoiceClone;
