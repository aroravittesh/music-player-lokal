import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
} from "react-native";
import { usePlayerStore } from "../store/playerStore";

const THUMB_SIZE = 18;
const THUMB_RADIUS = THUMB_SIZE / 2;

function formatTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

type Props = {
  variant?: "full" | "mini";
};

type Metrics = { x: number; width: number };

export default function PlaybackProgressBar({ variant = "full" }: Props) {
  const sound = usePlayerStore((s) => s.sound);
  const positionMillis = usePlayerStore((s) => s.positionMillis);
  const durationMillis = usePlayerStore((s) => s.durationMillis);
  const commitSeekProgress = usePlayerStore((s) => s.commitSeekProgress);

  const interactive = variant === "full";
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);

  const hitRef = useRef<View>(null);
  const layoutRef = useRef<Metrics>({ x: 0, width: 1 });

  const syncMetricsFromWindow = useCallback(() => {
    hitRef.current?.measureInWindow((x, _y, w) => {
      layoutRef.current = {
        x,
        width: Math.max(1, w),
      };
    });
  }, []);

  const ratioFromPageX = useCallback((pageX: number) => {
    const { x, width } = layoutRef.current;
    return clamp01((pageX - x) / width);
  }, []);

  const duration = durationMillis > 0 ? durationMillis : 0;
  const ratio =
    scrubbing && duration > 0
      ? scrubRatio
      : duration > 0
        ? clamp01(positionMillis / duration)
        : 0;

  const elapsedMs =
    scrubbing && duration > 0 ? scrubRatio * duration : positionMillis;
  const remainingMs =
    duration > 0 ? Math.max(0, duration - elapsedMs) : 0;

  const seekToRatio = useCallback(
    async (r: number) => {
      if (!sound || durationMillis <= 0) return;
      const clamped = clamp01(r);
      const pos = Math.round(clamped * durationMillis);
      commitSeekProgress(pos, durationMillis);
      try {
        await sound.setPositionAsync(pos);
      } catch (err) {
        console.log("Seek error:", err);
      }
    },
    [sound, durationMillis, commitSeekProgress]
  );

  const panHandlers = useMemo(() => {
    if (!interactive || durationMillis <= 0) {
      return {};
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const pageX = evt.nativeEvent.pageX;

        setScrubbing(true);
        setScrubRatio(ratioFromPageX(pageX));

        hitRef.current?.measureInWindow((x, _y, w) => {
          const width = Math.max(1, w);
          layoutRef.current = { x, width };
          setScrubRatio(clamp01((pageX - x) / width));
        });
      },
      onPanResponderMove: (evt) => {
        setScrubRatio(ratioFromPageX(evt.nativeEvent.pageX));
      },
      onPanResponderRelease: (evt) => {
        const r = ratioFromPageX(evt.nativeEvent.pageX);
        setScrubbing(false);
        seekToRatio(r);
      },
      onPanResponderTerminate: (evt) => {
        const r = ratioFromPageX(evt.nativeEvent.pageX);
        setScrubbing(false);
        seekToRatio(r);
      },
    }).panHandlers;
  }, [interactive, durationMillis, ratioFromPageX, seekToRatio]);

  if (variant === "mini") {
    return (
      <View style={styles.miniTrack} pointerEvents="none">
        <View style={[styles.miniFill, { width: `${ratio * 100}%` }]} />
      </View>
    );
  }

  return (
    <View style={styles.fullWrap}>
      <Text style={styles.timeText}>{formatTime(elapsedMs)}</Text>
      <View
        ref={hitRef}
        style={styles.barTouch}
        collapsable={false}
        onLayout={() => {
          requestAnimationFrame(() => syncMetricsFromWindow());
        }}
        {...panHandlers}
      >
        <View style={styles.trackSlot} pointerEvents="none">
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
          </View>
          <View
            style={[
              styles.thumb,
              {
                left: `${ratio * 100}%`,
                marginLeft: -THUMB_RADIUS,
              },
            ]}
          />
        </View>
      </View>
      <Text style={styles.timeRemaining}>
        {duration > 0 ? `-${formatTime(remainingMs)}` : "--:--"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingHorizontal: 4,
    gap: 10,
  },
  timeText: {
    width: 42,
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
    fontVariant: ["tabular-nums"],
  },
  timeRemaining: {
    width: 46,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
    fontVariant: ["tabular-nums"],
  },
  barTouch: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: "center",
  },
  trackSlot: {
    height: 28,
    justifyContent: "center",
    position: "relative",
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#27272a",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#6366f1",
    minWidth: 2,
  },
  thumb: {
    position: "absolute",
    top: (28 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    backgroundColor: "#fafafa",
    borderWidth: 2,
    borderColor: "#6366f1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  miniTrack: {
    height: 3,
    width: "100%",
    backgroundColor: "#27272a",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    minWidth: 2,
  },
});
