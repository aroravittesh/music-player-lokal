import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  View,
  StyleSheet,
  Dimensions,
  Easing,
  InteractionManager,
  PanResponder,
  type PanResponderGestureState,
} from "react-native";
import { usePlayerStore } from "../store/playerStore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ParamListBase } from "@react-navigation/native";

const { height: SCREEN_H } = Dimensions.get("window");
const START_REGION = SCREEN_H * 0.4;
const PARTIAL_THRESHOLD = 18;
const DISMISS_DISTANCE = SCREEN_H * 0.18;
const DISMISS_VELOCITY = 520;
const EXPAND_VY = -420;
const CLOSE_MS = 580;

type Props = {
  children: React.ReactNode;
  paddingTop: number;
  paddingBottom: number;
};

/**
 * Transparent stack + dimmed backdrop: dragging down reveals Home underneath.
 * Full sheet: only top ~40% starts a drag. When partially pulled down, drag works
 * anywhere (swipe up expands again). Dismiss uses animation:none pop to avoid flash.
 */
export default function PlayerDismissSheet({
  children,
  paddingTop,
  paddingBottom,
}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<ParamListBase, "Player">>();
  const translateY = useRef(new Animated.Value(0)).current;
  const baseOffset = useRef(0);
  const sheetOffsetRef = useRef(0);

  useEffect(() => {
    const sub = translateY.addListener(({ value }) => {
      sheetOffsetRef.current = value;
    });
    return () => translateY.removeListener(sub);
  }, [translateY]);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const runDismiss = useCallback(
    (onAfterNavigate?: () => void) => {
      navigation.setOptions({ animation: "none" });
      Animated.timing(translateY, {
        toValue: SCREEN_H + 56,
        duration: CLOSE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        goBack();
        if (onAfterNavigate) {
          InteractionManager.runAfterInteractions(() => {
            onAfterNavigate();
          });
        }
      });
    },
    [goBack, navigation, translateY]
  );

  const pendingSmoothDismissPlayer = usePlayerStore(
    (s: any) => s.pendingSmoothDismissPlayer
  );

  useEffect(() => {
    if (!pendingSmoothDismissPlayer) return;
    usePlayerStore.setState({ pendingSmoothDismissPlayer: false });
    runDismiss(() => {
      usePlayerStore.getState().clearPlaybackAtEnd();
    });
  }, [pendingSmoothDismissPlayer, runDismiss]);

  const runExpand = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 82,
      velocity: 0,
    }).start();
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt, g: PanResponderGestureState) => {
          const vertical =
            Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 0.55;
          if (!vertical) return false;
          if (sheetOffsetRef.current > PARTIAL_THRESHOLD) {
            return true;
          }
          const touchStartY = evt.nativeEvent.pageY - g.dy;
          return touchStartY <= START_REGION && g.dy > 0;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          translateY.stopAnimation((v) => {
            baseOffset.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = baseOffset.current + g.dy;
          const v = next > 0 ? next : next * 0.12;
          translateY.setValue(v);
        },
        onPanResponderRelease: (_, g: PanResponderGestureState) => {
          const currentY = Math.max(0, baseOffset.current + g.dy);
          const vy = typeof g.vy === "number" ? g.vy : 0;

          if (vy < EXPAND_VY) {
            runExpand();
            return;
          }

          const shouldClose =
            currentY > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;

          if (shouldClose) {
            runDismiss();
          } else {
            runExpand();
          }
        },
      }),
    [runDismiss, runExpand, translateY]
  );

  const dimOpacity = translateY.interpolate({
    inputRange: [0, SCREEN_H * 0.5, SCREEN_H],
    outputRange: [0.52, 0.12, 0],
    extrapolate: "clamp",
  });

  return (
    <View
      style={styles.root}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.dim, { opacity: dimOpacity }]}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingTop,
            paddingBottom,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handleRow} accessibilityLabel="Drag to move or close player">
          <View style={styles.pill} />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheet: {
    flex: 1,
    backgroundColor: "#09090b",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: "hidden",
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 10,
  },
  pill: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#3f3f46",
  },
});
