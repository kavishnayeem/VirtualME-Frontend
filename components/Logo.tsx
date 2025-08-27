import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Image } from 'react-native';

const MESH_URI = 'https://idoxe6s.sufydely.com/mesh.png';
const VM_URI = 'https://idoxe6s.sufydely.com/VM.png';

const Logo = ({ size = 64, style }: { size?: number; style?: any }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    const spin = () => {
      rotateAnim.setValue(0);
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000, // slower spin (6 seconds per rotation)
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isMounted) {
          spin();
        }
      });
    };

    spin();

    return () => {
      isMounted = false;
      rotateAnim.stopAnimation();
    };
  }, [rotateAnim]);

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Spinning mesh image */}
      <Animated.Image
        source={{ uri: MESH_URI }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: size / 8,
          transform: [{ rotate: spinInterpolate }],
        }}
        resizeMode="contain"
      />
      {/* Static VM image in the center */}
      <Image
        source={{ uri: VM_URI }}
        style={{
          position: 'absolute',
          width: '40%',
          height: '40%',
          borderRadius: size / 8,
        }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default Logo;
