import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme';

export function SplashScreen() {
  const opacity  = useRef(new Animated.Value(0)).current;
  const barScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(barScale, {
        toValue: 1,
        duration: 300,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, barScale]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={styles.wordmark}>aura</Text>
        <Animated.View
          style={[styles.bar, { transform: [{ scaleX: barScale }] }]}
        />
        <Text style={styles.tagline}>Know before you go</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  wordmark: {
    fontSize: FONT_SIZE.logo,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    letterSpacing: -1,
  },
  bar: {
    width: 48,
    height: 4,
    backgroundColor: COLORS.purple500,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  },
  tagline: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.body,
    marginTop: SPACING.xs,
  },
});
