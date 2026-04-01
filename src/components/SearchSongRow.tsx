import React, { useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Animated,
  ActivityIndicator,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  item: any;
  onPlayTrack: (song: any) => void;
  onAddToQueue: (song: any) => void;
  /** Track # for album/playlist rows (optional). */
  trackNumber?: number;
  rowStyle?: StyleProp<ViewStyle>;
  /** When set, shows a download / progress / remove control (e.g. Home search & Downloads). */
  downloadControl?: {
    isDownloaded: boolean;
    isDownloading: boolean;
    progress: number;
    onDownload: () => void;
    onRemoveDownload: () => void;
  };
};

export default function SearchSongRow({
  item,
  onPlayTrack,
  onAddToQueue,
  trackNumber,
  rowStyle,
  downloadControl,
}: Props) {
  const swipeRef = useRef<Swipeable>(null);

  const handlePlay = useCallback(() => {
    onPlayTrack(item);
  }, [item, onPlayTrack]);

  const handleAdd = useCallback(() => {
    onAddToQueue(item);
  }, [item, onAddToQueue]);

  /** Purple panel opacity follows swipe progress so it vanishes in sync with the row—no “see-through” overlap. */
  const renderLeftActions = useCallback(
    (
      progress: Animated.AnimatedInterpolation<number>,
      _dragX: Animated.AnimatedInterpolation<number>
    ) => (
      <Animated.View style={[styles.swipeLeftWrap, { opacity: progress }]}>
        <View style={styles.swipeLeft}>
          <MaterialCommunityIcons name="playlist-plus" size={26} color="#fafafa" />
          <Text style={styles.swipeLeftText}>Queue</Text>
        </View>
      </Animated.View>
    ),
    []
  );

  /**
   * Close soon after commit; enqueue after a tick so list re-render (toast) doesn’t
   * run mid-gesture. Spring uses overshootClamping so close never dips past 0 and
   * flashes the purple strip again.
   */
  const onSwipeableWillOpen = useCallback(
    (direction: "left" | "right") => {
      if (direction !== "left") return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          swipeRef.current?.close();
        });
      });
      setTimeout(() => {
        onAddToQueue(item);
      }, 0);
    },
    [item, onAddToQueue]
  );

  return (
    <Swipeable
      ref={swipeRef}
      friction={1}
      overshootLeft={false}
      leftThreshold={22}
      dragOffsetFromLeftEdge={6}
      renderLeftActions={renderLeftActions}
      onSwipeableWillOpen={onSwipeableWillOpen}
      animationOptions={{
        bounciness: 5,
        speed: 14,
        overshootClamping: true,
        restSpeedThreshold: 2,
        restDisplacementThreshold: 0.5,
      }}
      containerStyle={styles.swipeableContainer}
      childrenContainerStyle={styles.swipeRowSheet}
    >
      <View style={[styles.row, rowStyle]}>
        {trackNumber != null ? (
          <Text style={styles.trackIndex}>{trackNumber}</Text>
        ) : null}
        <Pressable
          onPress={handlePlay}
          style={styles.rowMain}
          android_ripple={{ color: "#27272a" }}
        >
          <Image
            source={{
              uri:
                item.imageUrl ||
                "https://via.placeholder.com/96/18181b/71717a?text=♪",
            }}
            style={styles.cover}
          />
          <View style={styles.songMeta}>
            <Text style={styles.songName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {item.primaryArtists || "Unknown Artist"}
            </Text>
          </View>
        </Pressable>

        {downloadControl ? (
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => {
              if (downloadControl.isDownloading) return;
              if (downloadControl.isDownloaded) {
                downloadControl.onRemoveDownload();
              } else {
                downloadControl.onDownload();
              }
            }}
            disabled={downloadControl.isDownloading}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
            accessibilityLabel={
              downloadControl.isDownloaded
                ? "Remove download"
                : downloadControl.isDownloading
                  ? "Downloading"
                  : "Download for offline"
            }
            activeOpacity={0.75}
          >
            {downloadControl.isDownloading ? (
              <View style={styles.downloadProgressWrap}>
                <ActivityIndicator color="#a5b4fc" size="small" />
              </View>
            ) : downloadControl.isDownloaded ? (
              <Ionicons name="trash-outline" size={22} color="#f87171" />
            ) : (
              <Ionicons name="download-outline" size={24} color="#818cf8" />
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleAdd}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          accessibilityLabel="Add to queue"
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name="playlist-plus"
            size={26}
            color="#818cf8"
          />
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
}

const ROW_BG = "#09090b";

const styles = StyleSheet.create({
  swipeableContainer: {
    overflow: "hidden",
  },
  /** Opaque sheet behind the row so it wipes cleanly over the purple (no double-exposure). */
  swipeRowSheet: {
    backgroundColor: ROW_BG,
  },
  /** No flex:1 — that stretched to full row width and made Swipeable open ~screen-wide. */
  swipeLeftWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
    alignSelf: "flex-start",
  },
  swipeLeft: {
    justifyContent: "center",
    alignItems: "center",
    width: 56,
    paddingVertical: 10,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    marginRight: 6,
    marginVertical: 4,
  },
  swipeLeftText: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    color: "#e0e7ff",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingRight: 2,
    backgroundColor: ROW_BG,
  },
  trackIndex: {
    width: 28,
    fontSize: 13,
    fontWeight: "600",
    color: "#52525b",
    textAlign: "center",
    marginRight: 4,
    flexShrink: 0,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#18181b",
    flexShrink: 0,
  },
  songMeta: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  songName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f4f4f5",
    letterSpacing: -0.2,
  },
  artistName: {
    marginTop: 3,
    fontSize: 12,
    color: "#71717a",
  },
  downloadBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 2,
  },
  downloadProgressWrap: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});
