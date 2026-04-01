import React, { useCallback, useMemo } from "react";
import { View, Text, FlatList, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerStore } from "../store/playerStore";
import { useDownloadsStore } from "../store/downloadsStore";
import SearchSongRow from "../components/SearchSongRow";
import QueueHintOverlay from "../components/QueueHintOverlay";
import { useQueueHint } from "../hooks/useQueueHint";

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const playNowKeepQueue = usePlayerStore((s) => s.playNowKeepQueue);
  const clearPlaybackContext = usePlayerStore((s) => s.clearPlaybackContext);
  const downloadEntries = useDownloadsStore((s) => s.entries);
  const removeDownload = useDownloadsStore((s) => s.removeDownload);
  const { message: queueHintMessage, enqueueWithFeedback } = useQueueHint();

  const rows = useMemo(() => {
    return Object.values(downloadEntries).sort(
      (a, b) => b.downloadedAt - a.downloadedAt
    );
  }, [downloadEntries]);

  const playTrack = useCallback(
    (song: any) => {
      clearPlaybackContext();
      playNowKeepQueue(song);
    },
    [clearPlaybackContext, playNowKeepQueue]
  );

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

  const renderItem = useCallback(
    ({ item }: { item: (typeof rows)[0] }) => (
      <SearchSongRow
        item={item.song}
        onPlayTrack={playTrack}
        onAddToQueue={enqueueWithFeedback}
        downloadControl={{
          isDownloaded: true,
          isDownloading: false,
          progress: 1,
          onDownload: () => {},
          onRemoveDownload: () =>
            confirmRemoveDownload(
              item.id,
              String(item.song?.name ?? "this track")
            ),
        }}
      />
    ),
    [playTrack, enqueueWithFeedback, confirmRemoveDownload]
  );

  const keyExtractor = useCallback((item: (typeof rows)[0]) => item.id, []);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          rows.length === 0 ? styles.listEmpty : { paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => (
          <View style={styles.rowSeparatorFull} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No downloads yet</Text>
            <Text style={styles.emptySub}>
              From search or an album, tap the download icon on a track to save it
              for offline playback.
            </Text>
          </View>
        }
      />
      <QueueHintOverlay
        message={queueHintMessage}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  rowSeparatorFull: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1c1c1f",
    marginLeft: 76,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e4e4e7",
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 15,
    lineHeight: 22,
    color: "#71717a",
    textAlign: "center",
    maxWidth: 300,
  },
});
