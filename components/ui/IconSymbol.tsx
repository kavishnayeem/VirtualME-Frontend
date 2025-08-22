// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols/src';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 *
 * Only use icon names that are valid for MaterialIcons.
 */

const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // 'waveform': 'waveform', // Removed: not a valid MaterialIcons name
  'person.fill': 'person', // user/account icon
  'person.crop.circle': 'account-circle',
  'gear': 'settings',
  'gearshape.fill': 'settings',
  'mic.fill': 'mic',
  'mic.slash.fill': 'mic-off',
  'lock.fill': 'lock',
  'lock.open.fill': 'lock-open',
  'star.fill': 'star',
  'star': 'star-outline',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'bell.fill': 'notifications',
  'bell': 'notifications-none',
  'envelope.fill': 'mail',
  'envelope': 'mail-outline',
  'checkmark': 'check',
  'xmark': 'close',
  'plus': 'add',
  'minus': 'remove',
  'arrow.right': 'arrow-forward',
  'arrow.left': 'arrow-back',
  'arrow.up': 'arrow-upward',
  'arrow.down': 'arrow-downward',
  'pencil': 'edit',
  'trash': 'delete',
  'calendar': 'calendar-today',
  'photo': 'photo',
  'camera': 'photo-camera',
  'globe': 'public',
  'info.circle': 'info',
  'questionmark.circle': 'help',
  'ellipsis': 'more-horiz',
  'ellipsis.circle': 'more-vert',

  // Added menu and voice related icons
  'menu': 'menu', // Material icon for menu/hamburger
  'waveform.circle': 'graphic-eq', // valid MaterialIcons name
  'waveform.and.mic': 'keyboard-voice', // valid MaterialIcons name
  'mic': 'mic-none', // non-filled mic
  'mic.circle': 'mic', // fallback to mic
  'mic.circle.fill': 'mic', // fallback to mic
  'speaker.wave.2.fill': 'volume-up', // speaker/voice output
  'speaker.slash.fill': 'volume-off', // muted speaker
  'voice.chat': 'forum', // valid MaterialIcons name
  'voice': 'record-voice-over', // valid MaterialIcons name
  // Add more mappings as needed, but only valid MaterialIcons names
} as const;

type MaterialIconName = typeof MAPPING[keyof typeof MAPPING];
type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Type assertion ensures only valid MaterialIcons names are used
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name] as MaterialIconName}
      style={style}
    />
  );
}
