import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Image,
  StyleSheet,
  ScrollView,
  Platform,
  Keyboard,
  BackHandler,
  Alert,
  type TextInput as TextInputType,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  SEARCH_PAGE_SIZE,
  searchAlbums,
  searchPlaylists,
  searchSongs,
  type AlbumSummary,
  type PlaylistSummary,
} from "../api/saavn";
import { usePlayerStore } from "../store/playerStore";
import { useDownloadsStore } from "../store/downloadsStore";
import SearchSongRow from "../components/SearchSongRow";
import QueueHintOverlay from "../components/QueueHintOverlay";
import { useQueueHint } from "../hooks/useQueueHint";

/** Debounce API search so typing does not stack network + re-renders. */
const SEARCH_DEBOUNCE_MS = 380;

function mergeUniqueById<T extends { id?: string | number }>(
  prev: T[],
  batch: T[]
): T[] {
  const seen = new Set(
    prev.map((x) => String(x.id ?? "")).filter(Boolean)
  );
  const add: T[] = [];
  for (const x of batch) {
    const id = String(x.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    add.push(x);
  }
  return add.length ? [...prev, ...add] : prev;
}

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState([]);
  const [searchAlbumHits, setSearchAlbumHits] = useState<AlbumSummary[]>([]);
  const [searchPlaylistHits, setSearchPlaylistHits] = useState<PlaylistSummary[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [songNextPage, setSongNextPage] = useState(1);
  const [albumNextPage, setAlbumNextPage] = useState(1);
  const [playlistNextPage, setPlaylistNextPage] = useState(1);
  const [songHasMore, setSongHasMore] = useState(false);
  const [albumHasMore, setAlbumHasMore] = useState(false);
  const [playlistHasMore, setPlaylistHasMore] = useState(false);
  const searchGeneration = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInputType | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const playNowKeepQueue = usePlayerStore((s) => s.playNowKeepQueue);
  const clearPlaybackContext = usePlayerStore((s) => s.clearPlaybackContext);
  const downloadEntries = useDownloadsStore((s) => s.entries);
  const downloadProgressById = useDownloadsStore(
    (s) => s.downloadProgressById
  );
  const downloadTrack = useDownloadsStore((s) => s.downloadTrack);
  const removeDownload = useDownloadsStore((s) => s.removeDownload);
  const { message: queueHintMessage, enqueueWithFeedback } = useQueueHint();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [homePlaylists, setHomePlaylists] = useState<PlaylistSummary[]>([]);

  const downloadCount = useMemo(
    () => Object.keys(downloadEntries).length,
    [downloadEntries]
  );

  useEffect(() => {
    let cancelled = false;
    searchPlaylists("featured")
      .then((list) => {
        if (cancelled) return;
        setHomePlaylists(list.slice(0, 18));
      })
      .catch(() => {
        if (!cancelled) setHomePlaylists([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    },
    []
  );

  const focusSearch = () => searchInputRef.current?.focus();

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  /** Browse / results: tap body opens search if idle; closes keyboard if already typing. */
  const onBodyTap = useCallback(() => {
    if (searchFocused) {
      dismissKeyboard();
    } else {
      focusSearch();
    }
  }, [searchFocused, dismissKeyboard]);

  const trimmed = query.trim();
  const showBrowseHome = trimmed.length < 2 && !loading;

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    const t = text.trim();

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (t.length < 2) {
      searchGeneration.current += 1;
      setSongs([]);
      setSearchAlbumHits([]);
      setSearchPlaylistHits([]);
      setSongNextPage(1);
      setAlbumNextPage(1);
      setPlaylistNextPage(1);
      setSongHasMore(false);
      setAlbumHasMore(false);
      setPlaylistHasMore(false);
      setLoadingMore(false);
      setLoading(false);
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      void (async () => {
        const gen = ++searchGeneration.current;

        try {
          setLoading(true);
          setSongs([]);
          setSearchAlbumHits([]);
          setSearchPlaylistHits([]);
          setSongNextPage(1);
          setAlbumNextPage(1);
          setPlaylistNextPage(1);
          setSongHasMore(false);
          setAlbumHasMore(false);
          setPlaylistHasMore(false);
          const [songRes, albumRes, playlistRes] = await Promise.allSettled([
            searchSongs(t, { page: 0, limit: SEARCH_PAGE_SIZE }),
            searchAlbums(t, { page: 0, limit: SEARCH_PAGE_SIZE }),
            searchPlaylists(t, { page: 0, limit: SEARCH_PAGE_SIZE }),
          ]);
          if (gen !== searchGeneration.current) return;
          const sl = songRes.status === "fulfilled" ? songRes.value : [];
          const al = albumRes.status === "fulfilled" ? albumRes.value : [];
          const pl = playlistRes.status === "fulfilled" ? playlistRes.value : [];
          setSongs(sl);
          setSearchAlbumHits(al);
          setSearchPlaylistHits(pl);
          setSongHasMore(sl.length === SEARCH_PAGE_SIZE);
          setAlbumHasMore(al.length === SEARCH_PAGE_SIZE);
          setPlaylistHasMore(pl.length === SEARCH_PAGE_SIZE);
        } catch (err) {
          console.log(err);
          if (gen !== searchGeneration.current) return;
          setSongs([]);
          setSearchAlbumHits([]);
          setSearchPlaylistHits([]);
        } finally {
          if (gen === searchGeneration.current) {
            setLoading(false);
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const loadMoreSearch = useCallback(async () => {
    const t = query.trim();
    if (t.length < 2 || loadingMore) return;
    if (!songHasMore && !albumHasMore && !playlistHasMore) return;

    const gen = searchGeneration.current;
    setLoadingMore(true);
    try {
      const songP = songHasMore
        ? searchSongs(t, { page: songNextPage, limit: SEARCH_PAGE_SIZE })
        : Promise.resolve(null);
      const albumP = albumHasMore
        ? searchAlbums(t, { page: albumNextPage, limit: SEARCH_PAGE_SIZE })
        : Promise.resolve(null);
      const playlistP = playlistHasMore
        ? searchPlaylists(t, { page: playlistNextPage, limit: SEARCH_PAGE_SIZE })
        : Promise.resolve(null);

      const [songBatch, albumBatch, playlistBatch] = await Promise.all([
        songP,
        albumP,
        playlistP,
      ]);

      if (gen !== searchGeneration.current) return;

      if (songBatch !== null) {
        setSongs((prev) => mergeUniqueById(prev, songBatch));
        setSongHasMore(songBatch.length === SEARCH_PAGE_SIZE);
        setSongNextPage((p) => p + 1);
      }
      if (albumBatch !== null) {
        setSearchAlbumHits((prev) => mergeUniqueById(prev, albumBatch));
        setAlbumHasMore(albumBatch.length === SEARCH_PAGE_SIZE);
        setAlbumNextPage((p) => p + 1);
      }
      if (playlistBatch !== null) {
        setSearchPlaylistHits((prev) => mergeUniqueById(prev, playlistBatch));
        setPlaylistHasMore(playlistBatch.length === SEARCH_PAGE_SIZE);
        setPlaylistNextPage((p) => p + 1);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoadingMore(false);
    }
  }, [
    query,
    loadingMore,
    songHasMore,
    albumHasMore,
    playlistHasMore,
    songNextPage,
    albumNextPage,
    playlistNextPage,
  ]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (searchFocused) {
          Keyboard.dismiss();
          searchInputRef.current?.blur();
          return true;
        }
        const t = query.trim();
        if (t.length >= 2 || loading) {
          Keyboard.dismiss();
          searchInputRef.current?.blur();
          handleSearch("");
          return true;
        }
        if (query.length > 0) {
          Keyboard.dismiss();
          searchInputRef.current?.blur();
          handleSearch("");
          return true;
        }
        return false;
      };

      const sub =
        Platform.OS === "android"
          ? BackHandler.addEventListener("hardwareBackPress", onBackPress)
          : null;

      return () => sub?.remove();
    }, [searchFocused, query, loading, handleSearch])
  );

  /** Play now; keep existing queue (swap into "now playing" slot). */
  const playTrack = useCallback(
    (song: any) => {
      dismissKeyboard();
      clearPlaybackContext();
      playNowKeepQueue(song);
    },
    [dismissKeyboard, clearPlaybackContext, playNowKeepQueue]
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

  const renderSongRow = useCallback(
    ({ item }: { item: any }) => {
      const id = String(item.id ?? "");
      const isDownloaded = Boolean(id && downloadEntries[id]);
      const isDownloading = Boolean(id && id in downloadProgressById);
      const progress = downloadProgressById[id] ?? 0;
      return (
        <SearchSongRow
          item={item}
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

  const listKeyExtractor = useCallback((item: any) => String(item.id), []);

  const nav = navigation as { navigate: (n: string, p?: object) => void };

  const searchHasAny =
    songs.length > 0 ||
    searchAlbumHits.length > 0 ||
    searchPlaylistHits.length > 0;

  const searchCanLoadMore =
    trimmed.length >= 2 &&
    !loading &&
    (songHasMore || albumHasMore || playlistHasMore);

  const resultSummary =
    loading || !searchHasAny
      ? ""
      : [
          songs.length > 0
            ? `${songs.length} song${songs.length === 1 ? "" : "s"}`
            : null,
          searchAlbumHits.length > 0
            ? `${searchAlbumHits.length} album${
                searchAlbumHits.length === 1 ? "" : "s"
              }`
            : null,
          searchPlaylistHits.length > 0
            ? `${searchPlaylistHits.length} playlist${
                searchPlaylistHits.length === 1 ? "" : "s"
              }`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const searchListHeader = (
    <View>
      {searchPlaylistHits.length > 0 ? (
        <View style={styles.searchCarouselBlock}>
          <Text style={styles.playlistSectionTitle}>Playlists</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playlistRow}
            keyboardShouldPersistTaps="handled"
          >
            {searchPlaylistHits.map((p) => (
              <TouchableOpacity
                key={`p-${p.id}`}
                style={styles.playlistCard}
                activeOpacity={0.85}
                onPress={() =>
                  nav.navigate("Playlist", {
                    playlistId: p.id,
                    title: p.name,
                    imageUrl: p.imageUrl || undefined,
                  })
                }
                accessibilityLabel={`Open playlist ${p.name}`}
              >
                <Image
                  source={{
                    uri:
                      p.imageUrl ||
                      "https://via.placeholder.com/132/18181b/71717a?text=♪",
                  }}
                  style={styles.playlistCover}
                />
                <Text style={styles.playlistName} numberOfLines={2}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {searchAlbumHits.length > 0 ? (
        <View
          style={[
            styles.searchCarouselBlock,
            searchPlaylistHits.length > 0 ? styles.searchCarouselAfter : null,
          ]}
        >
          <Text style={styles.playlistSectionTitle}>Albums</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playlistRow}
            keyboardShouldPersistTaps="handled"
          >
            {searchAlbumHits.map((a) => (
              <TouchableOpacity
                key={`a-${a.id}`}
                style={styles.playlistCard}
                activeOpacity={0.85}
                onPress={() =>
                  nav.navigate("Album", {
                    albumId: a.id,
                    title: a.name,
                    imageUrl: a.imageUrl || undefined,
                  })
                }
                accessibilityLabel={`Open album ${a.name}`}
              >
                <Image
                  source={{
                    uri:
                      a.imageUrl ||
                      "https://via.placeholder.com/132/18181b/71717a?text=♪",
                  }}
                  style={styles.playlistCover}
                />
                <Text style={styles.playlistName} numberOfLines={2}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {songs.length > 0 ? (
        <Text style={styles.tracksSectionHeading}>Tracks</Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.searchWrap}>
        <Ionicons
          name="search"
          size={20}
          color="#52525b"
          style={styles.searchIcon}
        />
        <TextInput
          ref={searchInputRef}
          placeholder="Songs, artists, albums…"
          placeholderTextColor="#52525b"
          value={query}
          onChangeText={handleSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          onSubmitEditing={dismissKeyboard}
        />
        {Platform.OS === "android" && query.length > 0 ? (
          <TouchableOpacity
            onPress={() => handleSearch("")}
            style={styles.clearSearch}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={22} color="#52525b" />
          </TouchableOpacity>
        ) : null}
      </View>

      {showBrowseHome ? (
        <ScrollView
          style={styles.browseScroller}
          contentContainerStyle={[
            styles.browseScroll,
            { paddingBottom: 110 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={styles.browsePressArea}
            onPress={onBodyTap}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroIconRing}>
                <View style={styles.heroIconInner}>
                  <Ionicons name="musical-notes" size={36} color="#a5b4fc" />
                </View>
              </View>
              <Text style={styles.heroTitle}>Discover music</Text>
              <Text style={styles.heroLead}>
                Search millions of tracks by song title, artist, or album.
              </Text>
              <View style={styles.hintPill}>
                <Ionicons name="sparkles" size={16} color="#818cf8" />
                <Text style={styles.hintPillText}>
                  Type at least 2 characters to search
                </Text>
              </View>
            </View>
          </Pressable>

          <TouchableOpacity
            style={styles.downloadsCard}
            onPress={() => nav.navigate("Downloads" as never)}
            activeOpacity={0.85}
            accessibilityLabel="Open downloads"
          >
            <View style={styles.downloadsCardIconWrap}>
              <Ionicons name="download" size={26} color="#a5b4fc" />
            </View>
            <View style={styles.downloadsCardTextCol}>
              <Text style={styles.downloadsCardTitle}>Downloads</Text>
              <Text style={styles.downloadsCardSub}>
                {downloadCount === 0
                  ? "Save songs for offline listening"
                  : `${downloadCount} song${downloadCount === 1 ? "" : "s"} saved`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#52525b" />
          </TouchableOpacity>

          {homePlaylists.length > 0 ? (
            <View style={styles.playlistSection}>
              <Text style={styles.playlistSectionTitle}>Playlists</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.playlistRow}
                keyboardShouldPersistTaps="handled"
              >
                {homePlaylists.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.playlistCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      nav.navigate("Playlist", {
                        playlistId: p.id,
                        title: p.name,
                        imageUrl: p.imageUrl || undefined,
                      })
                    }
                    accessibilityLabel={`Open playlist ${p.name}`}
                  >
                    <Image
                      source={{
                        uri:
                          p.imageUrl ||
                          "https://via.placeholder.com/132/18181b/71717a?text=♪",
                      }}
                      style={styles.playlistCover}
                    />
                    <Text style={styles.playlistName} numberOfLines={2}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.resultsTapLayer}>
          <View style={styles.resultsInner}>
            {loading ? (
              <View style={styles.resultsHeader}>
                <ActivityIndicator color="#818cf8" size="small" />
                <Text style={styles.searchingLabel}>Searching…</Text>
              </View>
            ) : (
              <Text style={styles.resultCount}>{resultSummary}</Text>
            )}

            <FlatList
              data={songs}
              keyExtractor={listKeyExtractor}
              renderItem={renderSongRow}
              style={styles.listFlex}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 140 + insets.bottom },
              ]}
              ListHeaderComponent={searchListHeader}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={12}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={Platform.OS === "android"}
              ItemSeparatorComponent={() => (
                <View style={styles.rowSeparatorFull} />
              )}
              ListEmptyComponent={
                !loading && !searchHasAny ? (
                  <Pressable onPress={onBodyTap}>
                    <View style={styles.noResults}>
                      <Ionicons
                        name="albums-outline"
                        size={44}
                        color="#3f3f46"
                      />
                      <Text style={styles.noResultsTitle}>No results</Text>
                      <Text style={styles.noResultsSub}>
                        Try another spelling or a shorter keyword.
                      </Text>
                    </View>
                  </Pressable>
                ) : null
              }
              ListFooterComponent={
                searchCanLoadMore ? (
                  <View style={styles.loadMoreFooter}>
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={loadMoreSearch}
                      disabled={loadingMore}
                      activeOpacity={0.85}
                      accessibilityLabel="Load more search results"
                    >
                      {loadingMore ? (
                        <ActivityIndicator color="#a5b4fc" />
                      ) : (
                        <Text style={styles.loadMoreText}>Load more</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          </View>
        </View>
      )}

      <QueueHintOverlay
        message={queueHintMessage}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    backgroundColor: "#09090b",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#27272a",
    backgroundColor: "#0c0c0e",
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 8,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    paddingRight: 6,
    fontSize: 16,
    color: "#e4e4e7",
  },
  clearSearch: {
    padding: 4,
  },
  browseScroller: {
    flex: 1,
  },
  browseScroll: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingVertical: 24,
  },
  heroCard: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  heroIconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "#312e81",
    backgroundColor: "#0c0c12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: { elevation: 4 },
    }),
  },
  heroIconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e1b4b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3730a3",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fafafa",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  heroLead: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: "#71717a",
    textAlign: "center",
    maxWidth: 300,
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#18181b",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#27272a",
  },
  hintPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  browsePressArea: {
    justifyContent: "center",
  },
  downloadsCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#18181b",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#27272a",
    gap: 14,
  },
  downloadsCardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadsCardTextCol: {
    flex: 1,
    minWidth: 0,
  },
  downloadsCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fafafa",
    letterSpacing: -0.2,
  },
  downloadsCardSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#71717a",
    fontWeight: "500",
  },
  playlistSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  playlistSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  playlistRow: {
    paddingHorizontal: 6,
    paddingRight: 18,
    gap: 14,
  },
  playlistCard: {
    width: 132,
  },
  playlistCover: {
    width: 132,
    height: 132,
    borderRadius: 12,
    backgroundColor: "#18181b",
  },
  playlistName: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#e4e4e7",
    lineHeight: 17,
  },
  resultsTapLayer: {
    flex: 1,
  },
  resultsInner: {
    flex: 1,
  },
  listFlex: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  searchingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a",
  },
  resultCount: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "600",
    color: "#52525b",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  listContent: {
    paddingTop: 4,
    flexGrow: 1,
  },
  searchCarouselBlock: {
    marginBottom: 10,
  },
  searchCarouselAfter: {
    marginTop: 20,
  },
  tracksSectionHeading: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "700",
    color: "#52525b",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  noResults: {
    marginTop: 56,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  noResultsTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#d4d4d8",
  },
  noResultsSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#52525b",
    textAlign: "center",
  },
  rowSeparatorFull: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1c1c1f",
  },
  loadMoreFooter: {
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: "center",
  },
  loadMoreBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#18181b",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#312e81",
    minWidth: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#a5b4fc",
    textAlign: "center",
  },
});
