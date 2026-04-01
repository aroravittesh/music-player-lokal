import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  message: string | null;
  bottomInset: number;
};

/** Snackbar-style hint; full phrase e.g. "Added to queue" (wide pill + shrink so text isn't clipped). */
export default function QueueHintOverlay({ message, bottomInset }: Props) {
  if (!message) return null;
  return (
    <View
      style={[styles.wrap, { bottom: bottomInset + 88 }]}
      pointerEvents="none"
    >
      <View style={styles.pill}>
        <Ionicons
          name="checkmark-circle"
          size={18}
          color="#86efac"
          style={styles.pillIcon}
        />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 50,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#27272a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    maxWidth: "96%",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillIcon: {
    marginRight: 10,
  },
  text: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#fafafa",
  },
});
