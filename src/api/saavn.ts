import axios from "axios";

const API = axios.create({
  baseURL: "https://saavn.sumit.co/api",
});

/** Shared shape for player / lists — same mapping as legacy search results. */
function normalizeSong(song: any) {
  const artistFromPrimaryArray = Array.isArray(song?.artists?.primary)
    ? song.artists.primary
        .map((artist: any) => artist?.name)
        .filter(Boolean)
        .join(", ")
    : "";

  const artistName =
    song?.primaryArtists ||
    song?.primary_artists ||
    artistFromPrimaryArray ||
    song?.subtitle ||
    "Unknown Artist";

  const imageFromArray = Array.isArray(song?.image)
    ? song.image.find((img: any) => img?.quality === "500x500")?.url ||
      song.image.find((img: any) => img?.quality === "500x500")?.link ||
      song.image.find((img: any) => img?.quality === "150x150")?.url ||
      song.image.find((img: any) => img?.quality === "150x150")?.link ||
      song.image[0]?.url ||
      song.image[0]?.link
    : "";

  return {
    ...song,
    primaryArtists: artistName,
    imageUrl: song?.image?.url || song?.image?.link || imageFromArray || "",
  };
}

function extractSongArray(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.songs)) return payload.songs;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

/** Server default is a small page (~10); bump for in-app search. */
export const SEARCH_PAGE_SIZE = 40;

export type SearchPaging = {
  page?: number;
  limit?: number;
};

export const searchSongs = async (query: string, options?: SearchPaging) => {
  const limit = options?.limit ?? SEARCH_PAGE_SIZE;
  const page = options?.page ?? 0;
  const res = await API.get("/search/songs", {
    params: { query: query.trim(), limit, page },
  });
  const results = res?.data?.data?.results || [];
  return results.map(normalizeSong);
};

/** GET /api/songs — browse / list (optional query params depend on server). */
export const fetchSongs = async (params?: Record<string, string | number>) => {
  const res = await API.get("/songs", params ? { params } : undefined);
  const raw = res?.data?.data ?? res?.data;
  return extractSongArray(raw).map(normalizeSong);
};

/** GET /api/songs/{id} — single song details. */
export const getSongById = async (id: string) => {
  const res = await API.get(`/songs/${encodeURIComponent(id)}`);
  const raw = res?.data?.data ?? res?.data;
  const song =
    raw?.song ??
    (Array.isArray(raw?.results) ? raw.results[0] : undefined) ??
    raw;
  if (!song || typeof song !== "object" || Array.isArray(song)) return null;
  return normalizeSong(song);
};

/** GET /api/songs/{id}/suggestions — related / recommended tracks. */
export const getSongSuggestions = async (id: string) => {
  const res = await API.get(
    `/songs/${encodeURIComponent(id)}/suggestions`
  );
  const raw = res?.data?.data ?? res?.data;
  return extractSongArray(raw).map(normalizeSong);
};

function pickArtworkImage(image: unknown): string {
  if (!Array.isArray(image)) return "";
  const five = image.find(
    (img: any) => img?.quality === "500x500"
  ) as { url?: string } | undefined;
  const one = image.find(
    (img: any) => img?.quality === "150x150"
  ) as { url?: string } | undefined;
  return five?.url || one?.url || (image[0] as any)?.url || "";
}

export type PlaylistSummary = {
  id: string;
  name: string;
  imageUrl: string;
  songCount?: number;
};

function normalizePlaylistSummary(raw: any): PlaylistSummary {
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "Playlist"),
    imageUrl: pickArtworkImage(raw?.image),
    songCount:
      typeof raw?.songCount === "number" ? raw.songCount : undefined,
  };
}

/** GET /api/search/playlists?query=… */
export const searchPlaylists = async (query: string, options?: SearchPaging) => {
  const limit = options?.limit ?? SEARCH_PAGE_SIZE;
  const page = options?.page ?? 0;
  const res = await API.get("/search/playlists", {
    params: {
      query: query.trim() || "featured",
      limit,
      page,
    },
  });
  const results = res?.data?.data?.results || [];
  return results.map(normalizePlaylistSummary);
};

export type PlaylistDetail = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  songs: ReturnType<typeof normalizeSong>[];
};

const PLAYLIST_PAGE_LIMIT = 100;

/**
 * GET /api/playlists?id=…&page=&limit=
 * Fetches all pages until a short page is returned.
 */
export const getPlaylist = async (id: string): Promise<PlaylistDetail | null> => {
  if (!id) return null;

  let page = 0;
  let meta: any = null;
  const songs: ReturnType<typeof normalizeSong>[] = [];

  for (;;) {
    const res = await API.get("/playlists", {
      params: { id, page, limit: PLAYLIST_PAGE_LIMIT },
    });
    if (!res?.data?.success || !res?.data?.data) {
      if (meta) break;
      return null;
    }

    const data = res.data.data;
    if (!meta) meta = data;

    const batch = Array.isArray(data?.songs) ? data.songs : [];
    songs.push(...batch.map(normalizeSong));

    if (batch.length < PLAYLIST_PAGE_LIMIT) break;
    page += 1;
  }

  if (!meta) return null;

  return {
    id: String(meta.id ?? id),
    name: String(meta.name ?? "Playlist"),
    description:
      meta.description != null && String(meta.description).trim()
        ? String(meta.description).trim()
        : null,
    imageUrl: pickArtworkImage(meta.image),
    songs,
  };
};

export type AlbumSummary = {
  id: string;
  name: string;
  imageUrl: string;
  year?: number;
};

function normalizeAlbumSummary(raw: any): AlbumSummary {
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "Album"),
    imageUrl: pickArtworkImage(raw?.image),
    year: typeof raw?.year === "number" ? raw.year : undefined,
  };
}

/** GET /api/search/albums?query=… */
export const searchAlbums = async (query: string, options?: SearchPaging) => {
  const limit = options?.limit ?? SEARCH_PAGE_SIZE;
  const page = options?.page ?? 0;
  const res = await API.get("/search/albums", {
    params: { query: query.trim() || "hindi", limit, page },
  });
  const results = res?.data?.data?.results || [];
  return results.map(normalizeAlbumSummary);
};

export type AlbumDetail = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  songs: ReturnType<typeof normalizeSong>[];
};

const ALBUM_PAGE_LIMIT = 100;

/**
 * GET /api/albums?id=…&page=&limit=
 * Fetches all pages until a short page is returned.
 */
export const getAlbum = async (id: string): Promise<AlbumDetail | null> => {
  if (!id) return null;

  let page = 0;
  let meta: any = null;
  const songs: ReturnType<typeof normalizeSong>[] = [];

  for (;;) {
    const res = await API.get("/albums", {
      params: { id, page, limit: ALBUM_PAGE_LIMIT },
    });
    if (!res?.data?.success || !res?.data?.data) {
      if (meta) break;
      return null;
    }

    const data = res.data.data;
    if (!meta) meta = data;

    const batch = Array.isArray(data?.songs) ? data.songs : [];
    songs.push(...batch.map(normalizeSong));

    if (batch.length < ALBUM_PAGE_LIMIT) break;
    page += 1;
  }

  if (!meta) return null;

  const desc =
    meta.description != null && String(meta.description).trim()
      ? String(meta.description).trim()
      : null;

  return {
    id: String(meta.id ?? id),
    name: String(meta.name ?? "Album"),
    description: desc,
    imageUrl: pickArtworkImage(meta.image),
    songs,
  };
};
