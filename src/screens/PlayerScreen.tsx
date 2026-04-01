import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerStore } from "../store/playerStore";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ParamListBase } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import PlayerDismissSheet from "../components/PlayerDismissSheet";
import PlaybackProgressBar from "../components/PlaybackProgressBar";

export default function PlayerScreen() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const sound = usePlayerStore((s) => s.sound);

  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);

  const nextSong = usePlayerStore((s) => s.nextSong);
  const prevSong = usePlayerStore((s) => s.prevSong);

  const playbackContext = usePlayerStore((s) => s.playbackContext);
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled);
  const autoPlayEnabled = usePlayerStore((s) => s.autoPlayEnabled);
  const setAutoPlayEnabled = usePlayerStore((s) => s.setAutoPlayEnabled);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  const navigation =
    useNavigation<NativeStackNavigationProp<ParamListBase, "Player">>();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ animation: "slide_from_bottom" });
    }, [navigation])
  );

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
      console.log("PlayPause error:", err);
    }
  };

  const albumName =
    typeof currentSong?.album === "object" && currentSong?.album?.name
      ? currentSong.album.name
      : typeof currentSong?.album === "string"
        ? currentSong.album
        : null;

  const coverSize = Math.min(300, Dimensions.get("window").width - 48);

  return (
    <PlayerDismissSheet
      paddingTop={insets.top}
      paddingBottom={Math.max(insets.bottom, 20)}
    >
      <View style={styles.inner}>
        {currentSong ? (
          <>
            <View style={styles.artSection}>
              <View style={[styles.artShadowWrap, { width: coverSize, height: coverSize }]}>
                <Image
                  source={{
                    uri:
                      currentSong.imageUrl ||
                      "https://via.placeholder.com/300/18181b/a1a1aa?text=♪",
                  }}
                  style={[styles.cover, { width: coverSize, height: coverSize }]}
                />
              </View>
            </View>

            <View style={styles.metaBlock}>
              <Text style={styles.songName} numberOfLines={2}>
                {currentSong.name}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {currentSong.primaryArtists}
              </Text>
              {albumName ? (
                <Text style={styles.albumName} numberOfLines={1}>
                  {albumName}
                </Text>
              ) : null}
            </View>

            <PlaybackProgressBar variant="full" />

            <View
              style={[
                styles.modeRow,
                !playbackContext && styles.modeRowCentered,
              ]}
            >
              <TouchableOpacity
                onPress={() => setAutoPlayEnabled(!autoPlayEnabled)}
                style={[
                  styles.modeBtnIconOnly,
                  autoPlayEnabled && styles.modeBtnOn,
                ]}
                activeOpacity={0.75}
                accessibilityLabel={
                  autoPlayEnabled ? "Turn off auto play" : "Turn on auto play"
                }
              >
                <Ionicons
                  name="repeat"
                  size={24}
                  color={autoPlayEnabled ? "#a5b4fc" : "#71717a"}
                />
              </TouchableOpacity>

              {playbackContext ? (
                <TouchableOpacity
                  onPress={() => toggleShuffle()}
                  style={[
                    styles.modeBtnIconOnly,
                    shuffleEnabled && styles.modeBtnOn,
                  ]}
                  activeOpacity={0.75}
                  accessibilityLabel={
                    shuffleEnabled ? "Turn off shuffle" : "Turn on shuffle"
                  }
                >
                  <Ionicons
                    name="shuffle"
                    size={24}
                    color={shuffleEnabled ? "#a5b4fc" : "#71717a"}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.transport}>
              <TouchableOpacity
                onPress={prevSong}
                style={styles.skipBtn}
                activeOpacity={0.75}
                accessibilityLabel="Previous track"
              >
                <Ionicons name="play-skip-back" size={22} color="#e4e4e7" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePlayPause}
                style={styles.mainPlayBtn}
                activeOpacity={0.85}
                accessibilityLabel={isPlaying ? "Pause" : "Play"}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={36}
                  color="#fafafa"
                  style={!isPlaying ? styles.mainPlayIconNudge : undefined}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={nextSong}
                style={styles.skipBtn}
                activeOpacity={0.75}
                accessibilityLabel="Next track"
              >
                <Ionicons name="play-skip-forward" size={22} color="#e4e4e7" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("Queue" as never)}
              style={styles.queueRow}
              activeOpacity={0.7}
            >
              <Ionicons name="list" size={20} color="#818cf8" />
              <Text style={styles.queueText}>View queue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No song selected</Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backHint}
            >
              <Text style={styles.backHintText}>Go back to search</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </PlayerDismissSheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  artSection: {
    alignItems: "center",
    marginTop: 8,
  },
  artShadowWrap: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#18181b",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
      },
      android: {
        elevation: 18,
      },
    }),
  },
  cover: {
    borderRadius: 22,
    backgroundColor: "#18181b",
  },
  metaBlock: {
    marginTop: 28,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  songName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fafafa",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  artistName: {
    marginTop: 10,
    fontSize: 16,
    color: "#a1a1aa",
    textAlign: "center",
    fontWeight: "500",
  },
  albumName: {
    marginTop: 6,
    fontSize: 13,
    color: "#71717a",
    textAlign: "center",
  },
  modeRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
  },
  modeRowCentered: {
    justifyContent: "center",
  },
  modeBtnOn: {
    backgroundColor: "#3f3f46",
  },
  modeBtnIconOnly: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  transport: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  skipBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  mainPlayBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#4f46e5",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#4f46e5",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  mainPlayIconNudge: {
    marginLeft: 4,
  },
  queueRow: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  queueText: {
    color: "#a5b4fc",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#a1a1aa",
    fontSize: 16,
  },
  backHint: {
    marginTop: 16,
  },
  backHintText: {
    color: "#818cf8",
    fontWeight: "600",
  },
});
