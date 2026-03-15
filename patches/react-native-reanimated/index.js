// Stub for react-native-reanimated — used by react-native-css-interop for CSS animations only
// This project does not use CSS keyframe animations, so these are safe no-ops

const noop = () => {};
const makeMutable = (v) => ({ value: v, modify: noop });
const withRepeat = (animation) => animation;
const withSequence = (...animations) => animations[animations.length - 1];
const withTiming = (v) => v;
const withSpring = (v) => v;
const withDelay = (delay, animation) => animation;
const useSharedValue = (v) => ({ value: v });
const useAnimatedStyle = (fn) => fn();
const Animated = { View: require('react-native').View, Text: require('react-native').Text };

module.exports = {
  makeMutable,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  useSharedValue,
  useAnimatedStyle,
  Animated,
  default: { makeMutable, withRepeat, withSequence, withTiming, withSpring, withDelay, useSharedValue, useAnimatedStyle, Animated },
};
