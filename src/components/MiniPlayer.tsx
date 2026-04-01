import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayerStore } from "../store/playerStore";
import { useNavigation } from "@react-navigation/native";
import PlaybackProgressBar from "./PlaybackProgressBar";

export default function MiniPlayer() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const sound = usePlayerStore((s) => s.sound);

  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  if (!currentSong) return null;

  const handlePlayPause = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
        pause();
      } else {
        await sound.playAsync();
        play();
      }
    } catch (err) {
      console.log("MiniPlayer error:", err);
    }
  };

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("Player" as never)}
      style={[styles.container, { bottom: insets.bottom + 14 }]}
      activeOpacity={0.95}
    >
      <View style={styles.row}>
        <Image
          source={{
            uri:
              currentSong.imageUrl ||
              "https://via.placeholder.com/150/111111/FFFFFF?text=Music",
          }}
          style={styles.cover}
        />

        <View style={styles.songMeta}>
          <Text style={styles.songName} numberOfLines={1}>
            {currentSong.name}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {currentSong.primaryArtists}
          </Text>
        </View>

        <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color="#e0e7ff"
            style={!isPlaying ? styles.playIconNudge : undefined}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.miniBarSlot} pointerEvents="none">
        <PlaybackProgressBar variant="mini" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "#18181b",
    borderRadius: 16,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
  },
  miniBarSlot: {
    marginHorizontal: -10,
    marginBottom: 0,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#27272a",
  },
  songMeta: {
    flex: 1,
    marginHorizontal: 10,
  },
  songName: {
    color: "#fafafa",
    fontWeight: "700",
    fontSize: 14,
  },
  artistName: {
    marginTop: 2,
    color: "#a1a1aa",
    fontSize: 12,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#312e81",
    alignItems: "center",
    justifyContent: "center",
  },
  playIconNudge: {
    marginLeft: 2,
  },
});