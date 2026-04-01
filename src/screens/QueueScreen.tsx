import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayerStore } from "../store/playerStore";

export default function QueueScreen() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const removeFromQueueAtIndex = usePlayerStore((s) => s.removeFromQueueAtIndex);
  const moveQueueItem = usePlayerStore((s) => s.moveQueueItem);
  const insets = useSafeAreaInsets();

  const renderItem = ({ item, index }: any) => {
    const isCurrent = index === currentIndex;
    return (
      <View style={[styles.queueCard, isCurrent && styles.queueCardActive]}>
        <View style={styles.reorderCol}>
          <TouchableOpacity
            onPress={() => moveQueueItem(index, index - 1)}
            disabled={index === 0}
            style={[styles.reorderBtn, index === 0 && styles.reorderBtnOff]}
            hitSlop={{ top: 6, bottom: 2, left: 4, right: 4 }}
            accessibilityLabel="Move up"
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={index === 0 ? "#3f3f46" : "#a1a1aa"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveQueueItem(index, index + 1)}
            disabled={index >= queue.length - 1}
            style={[
              styles.reorderBtn,
              index >= queue.length - 1 && styles.reorderBtnOff,
            ]}
            hitSlop={{ top: 2, bottom: 6, left: 4, right: 4 }}
            accessibilityLabel="Move down"
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={index >= queue.length - 1 ? "#3f3f46" : "#a1a1aa"}
            />
          </TouchableOpacity>
        </View>

        <Image
          source={{
            uri:
              item.imageUrl ||
              "https://via.placeholder.com/150/111111/FFFFFF?text=Music",
          }}
          style={styles.cover}
        />
        <View style={styles.meta}>
          <Text style={styles.songName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {item.primaryArtists}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => removeFromQueueAtIndex(index)}
          style={styles.removeButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove from queue"
        >
          <Ionicons name="close-circle" size={22} color="#fca5a5" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Text style={styles.title}>Your Queue</Text>
      <Text style={styles.subtitle}>
        Saved on this device · drag order with ↑ ↓
      </Text>

      {queue.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySub}>
            Search for songs, tap + or swipe right on a row to add.
          </Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item: any, i: number) =>
            `${String(item?.id ?? "track")}-${i}`
          }
          renderItem={renderItem}
          contentContainerStyle={{
            paddingBottom: 140 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#09090b",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fafafa",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#71717a",
    marginBottom: 12,
    fontWeight: "500",
  },
  queueCard: {
    backgroundColor: "#18181b",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  queueCardActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#1c1c1f",
  },
  reorderCol: {
    marginRight: 4,
    justifyContent: "center",
  },
  reorderBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  reorderBtnOff: {
    opacity: 0.35,
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#27272a",
  },
  meta: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    minWidth: 0,
  },
  songName: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "700",
  },
  artistName: {
    marginTop: 4,
    color: "#a1a1aa",
    fontSize: 12,
  },
  removeButton: {
    padding: 4,
  },
  emptyWrap: {
    marginTop: 30,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  emptyTitle: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "700",
  },
  emptySub: {
    marginTop: 6,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 20,
  },
});
