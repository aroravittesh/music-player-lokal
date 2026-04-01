import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAlbum, type AlbumDetail } from "../api/saavn";
import { usePlayerStore } from "../store/playerStore";
import { useDownloadsStore } from "../store/downloadsStore";
import SearchSongRow from "../components/SearchSongRow";
import QueueHintOverlay from "../components/QueueHintOverlay";
import { useQueueHint } from "../hooks/useQueueHint";

type AlbumRoute = RouteProp<
  { Album: { albumId: string; title?: string; imageUrl?: string } },
  "Album"
>;

export default function AlbumScreen() {
  const route = useRoute<AlbumRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const insets = useSafeAreaInsets();
  const { albumId, title: paramTitle, imageUrl: paramImage } = route.params;

  const setQueue = usePlayerStore((s) => s.setQueue);
  const setSong = usePlayerStore((s) => s.setSong);
  const playNowKeepQueue = usePlayerStore((s) => s.playNowKeepQueue);
  const setPlaybackContext = usePlayerStore((s) => s.setPlaybackContext);
  const playbackContext = usePlayerStore((s) => s.playbackContext);
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const downloadEntries = useDownloadsStore((s) => s.entries);
  const downloadProgressById = useDownloadsStore(
    (s) => s.downloadProgressById
  );
  const downloadTrack = useDownloadsStore((s) => s.downloadTrack);
  const removeDownload = useDownloadsStore((s) => s.removeDownload);
  const { message: queueHintMessage, enqueueWithFeedback } = useQueueHint();

  const [detail, setDetail] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: detail?.name ?? paramTitle ?? "Album",
    });
  }, [navigation, detail?.name, paramTitle]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAlbum(albumId)
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setError("Could not load this album.");
          setDetail(null);
        } else {
          setDetail(d);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load this album.");
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  const heroW = Dimensions.get("window").width - 32;
  const coverUri = detail?.imageUrl || paramImage || "";

  const playAll = useCallback(() => {
    const songs = detail?.songs ?? [];
    if (songs.length === 0) return;
    setPlaybackContext({
      kind: "album",
      id: albumId,
      originalSongs: [...songs],
    });
    setQueue(songs);
    setSong(songs[0], 0);
  }, [albumId, detail?.songs, setPlaybackContext, setQueue, setSong]);

  const playTrack = useCallback(
    (song: any) => {
      const songs = detail?.songs ?? [];
      if (songs.length === 0) return;
      setPlaybackContext({
        kind: "album",
        id: albumId,
        originalSongs: [...songs],
      });
      playNowKeepQueue(song);
    },
    [albumId, detail?.songs, playNowKeepQueue, setPlaybackContext]
  );

  const shuffleOnHere =
    playbackContext?.kind === "album" &&
    playbackContext.id === albumId &&
    shuffleEnabled;

  const confirmRemoveDownload = useCallback(
    (id: string, title: string) => {
      Alert.alert(
        "Remove download",
        `Remove "${title}" from this device?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              void removeDownload(id);
            },
          },
        ]
      );
    },
    [removeDownload]
  );

  const renderSongRow = useCallback(
    ({ item, index }: any) => {
      const id = String(item.id ?? "");
      const isDownloaded = Boolean(id && downloadEntries[id]);
      const isDownloading = Boolean(id && id in downloadProgressById);
      const progress = downloadProgressById[id] ?? 0;
      return (
        <SearchSongRow
          item={item}
          trackNumber={index + 1}
          onPlayTrack={playTrack}
          onAddToQueue={enqueueWithFeedback}
          downloadControl={{
            isDownloaded,
            isDownloading,
            progress,
            onDownload: () => {
              void downloadTrack(item);
            },
            onRemoveDownload: () => {
              confirmRemoveDownload(id, String(item.name ?? "this track"));
            },
          }}
        />
      );
    },
    [
      playTrack,
      enqueueWithFeedback,
      downloadEntries,
      downloadProgressById,
      downloadTrack,
      confirmRemoveDownload,
    ]
  );

  const onShufflePress = useCallback(() => {
    const songs = detail?.songs ?? [];
    if (songs.length === 0) return;
    if (
      playbackContext?.kind === "album" &&
      playbackContext.id === albumId
    ) {
      toggleShuffle();
      return;
    }
    playAll();
    toggleShuffle();
  }, [
    albumId,
    detail?.songs,
    playbackContext?.id,
    playbackContext?.kind,
    playAll,
    toggleShuffle,
  ]);

  const ListHeader = (
    <View style={styles.headerBlock}>
      <View style={[styles.coverShadow, { width: heroW, height: heroW }]}>
        <Image
          source={{
            uri:
              coverUri ||
              "https://via.placeholder.com/400/18181b/a1a1aa?text=♪",
          }}
          style={[styles.cover, { width: heroW, height: heroW }]}
        />
      </View>

      {detail?.description ? (
        <Text style={styles.desc} numberOfLines={4}>
          {detail.description}
        </Text>
      ) : null}

      <View style={styles.playRow}>
        <TouchableOpacity
          style={[
            styles.shuffleIconBtn,
            shuffleOnHere && styles.shuffleIconBtnOn,
            !detail?.songs?.length && styles.shuffleIconBtnDisabled,
          ]}
          onPress={onShufflePress}
          disabled={!detail?.songs?.length}
          activeOpacity={0.75}
          accessibilityLabel={
            shuffleOnHere ? "Turn off shuffle" : "Turn on shuffle"
          }
        >
          <Ionicons
            name="shuffle"
            size={22}
            color={
              !detail?.songs?.length
                ? "#52525b"
                : shuffleOnHere
                  ? "#a5b4fc"
                  : "#a1a1aa"
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.playAllBtn,
            styles.playAllBtnGrow,
            !detail?.songs?.length && styles.playAllDisabled,
          ]}
          onPress={playAll}
          disabled={!detail?.songs?.length}
          activeOpacity={0.85}
          accessibilityLabel="Play album"
        >
          <Ionicons name="play" size={22} color="#fafafa" style={styles.playIcon} />
          <Text style={styles.playAllText}>Play</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.listHeading}>
        {detail?.songs?.length
          ? `${detail.songs.length} track${detail.songs.length === 1 ? "" : "s"}`
          : loading
            ? ""
            : "No tracks"}
      </Text>
    </View>
  );

  if (loading && !detail) {
    return (
      <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
        <View style={styles.loadingColumn}>
          <ActivityIndicator color="#818cf8" size="large" />
          <Text style={styles.loadingHint}>Loading album…</Text>
        </View>
      </View>
    );
  }

  if (error && !detail) {
    return (
      <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
        <View style={styles.loadingColumn}>
          <Ionicons name="alert-circle-outline" size={44} color="#71717a" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      <FlatList
        data={detail?.songs ?? []}
        keyExtractor={(item: any, index: number) =>
          `${String(item?.id ?? item?.songid ?? "s")}-${index}`
        }
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 110 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyTracks}>No songs on this album.</Text>
          ) : null
        }
        renderItem={renderSongRow}
      />
      <QueueHintOverlay
        message={queueHintMessage}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#09090b",
  },
  loadingColumn: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingHint: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    color: "#71717a",
    fontWeight: "600",
    textAlign: "center",
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    color: "#a1a1aa",
    textAlign: "center",
    maxWidth: 280,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerBlock: {
    alignItems: "center",
    marginBottom: 8,
  },
  coverShadow: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#18181b",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 14 },
    }),
  },
  cover: {
    borderRadius: 16,
    backgroundColor: "#18181b",
  },
  desc: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "#a1a1aa",
    textAlign: "center",
    alignSelf: "stretch",
  },
  playRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 12,
  },
  shuffleIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  shuffleIconBtnOn: {
    backgroundColor: "#3f3f46",
  },
  shuffleIconBtnDisabled: {
    opacity: 0.45,
  },
  playAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    gap: 8,
    minWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#4f46e5",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  playAllBtnGrow: {
    flex: 1,
  },
  playAllDisabled: {
    opacity: 0.45,
  },
  playIcon: {
    marginRight: 2,
  },
  playAllText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fafafa",
    letterSpacing: 0.3,
  },
  listHeading: {
    alignSelf: "flex-start",
    marginTop: 28,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "700",
    color: "#52525b",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1c1c1f",
    marginLeft: 76,
  },
  emptyTracks: {
    textAlign: "center",
    marginTop: 24,
    color: "#71717a",
    fontSize: 15,
  },
});
