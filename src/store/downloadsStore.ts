import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createDownloadResumable,
  documentDirectory,
  downloadAsync,
  deleteAsync,
  getInfoAsync,
} from "expo-file-system/legacy";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ensureOfflineDirs,
  audioFilePathForId,
  coverFilePathForId,
} from "../offline/offlinePaths";
import { getRemoteStreamUrl } from "../audio/getPlayableUri";

export type DownloadedTrack = {
  id: string;
  /** Snapshot of song fields for UI / queue (same shape as API). */
  song: any;
  audioPath: string;
  imagePath: string | null;
  downloadedAt: number;
};

type ProgressMap = Record<string, number>;

type DownloadsState = {
  entries: Record<string, DownloadedTrack>;
  downloadProgressById: ProgressMap;
  downloadErrorById: Record<string, string | null>;
};

type DownloadsActions = {
  getLocalAudioPath: (id: string) => string | null;
  getDownloadedList: () => DownloadedTrack[];
  isDownloaded: (id: string) => boolean;
  isDownloading: (id: string) => boolean;
  getProgress: (id: string) => number;
  getError: (id: string) => string | null;
  downloadTrack: (song: any) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
};

export const useDownloadsStore = create(
  persist<DownloadsState & DownloadsActions>(
    (set, get) => ({
      entries: {},
      downloadProgressById: {},
      downloadErrorById: {},

      getLocalAudioPath: (id: string) => {
        const e = get().entries[id];
        return e?.audioPath ?? null;
      },

      getDownloadedList: () => {
        const e = get().entries;
        return Object.keys(e)
          .map((k) => e[k])
          .sort((a, b) => b.downloadedAt - a.downloadedAt);
      },

      isDownloaded: (id: string) => Boolean(get().entries[id]),

      isDownloading: (id: string) => id in get().downloadProgressById,

      getProgress: (id: string) => get().downloadProgressById[id] ?? 0,

      getError: (id: string) => get().downloadErrorById[id] ?? null,

      downloadTrack: async (song: any) => {
        const id = song?.id != null ? String(song.id) : "";
        if (!id) return;
        if (get().entries[id]) return;

        const remote = getRemoteStreamUrl(song);
        if (!remote) {
          set((s) => ({
            downloadErrorById: {
              ...s.downloadErrorById,
              [id]: "No audio URL",
            },
          }));
          return;
        }

        if (!documentDirectory) {
          set((s) => ({
            downloadErrorById: {
              ...s.downloadErrorById,
              [id]: "Offline storage unavailable",
            },
          }));
          return;
        }

        set((s) => ({
          downloadProgressById: { ...s.downloadProgressById, [id]: 0 },
          downloadErrorById: { ...s.downloadErrorById, [id]: null },
        }));

        try {
          await ensureOfflineDirs();
          const dest = audioFilePathForId(id);

          try {
            const existing = await getInfoAsync(dest);
            if (existing.exists) await deleteAsync(dest);
          } catch {
            /* no file */
          }

          const callback = (progress: {
            totalBytesWritten: number;
            totalBytesExpectedToWrite: number;
          }) => {
            const total = progress.totalBytesExpectedToWrite;
            const ratio =
              total && total > 0
                ? progress.totalBytesWritten / total
                : progress.totalBytesWritten > 0
                  ? 0.08
                  : 0;
            set((s) => ({
              downloadProgressById: {
                ...s.downloadProgressById,
                [id]: Math.min(0.99, ratio),
              },
            }));
          };

          const resumable = createDownloadResumable(
            remote,
            dest,
            {},
            callback
          );
          const result = await resumable.downloadAsync();
          if (!result?.uri) throw new Error("Download failed");

          let imagePath: string | null = null;
          const coverUrl =
            typeof song.imageUrl === "string" ? song.imageUrl : null;
          if (coverUrl && /^https?:\/\//i.test(coverUrl)) {
            const cDest = coverFilePathForId(id);
            try {
              const cr = await downloadAsync(coverUrl, cDest);
              if (cr?.uri) imagePath = cr.uri;
            } catch {
              imagePath = null;
            }
          }

          const snapshot = {
            ...song,
            imageUrl: imagePath || song.imageUrl,
          };

          set((s) => {
            const nextProg = { ...s.downloadProgressById };
            delete nextProg[id];
            const nextErr = { ...s.downloadErrorById };
            delete nextErr[id];
            return {
              entries: {
                ...s.entries,
                [id]: {
                  id,
                  song: snapshot,
                  audioPath: result.uri,
                  imagePath,
                  downloadedAt: Date.now(),
                },
              },
              downloadProgressById: nextProg,
              downloadErrorById: nextErr,
            };
          });
        } catch (e: any) {
          const msg = e?.message ? String(e.message) : "Download failed";
          set((s) => {
            const nextProg = { ...s.downloadProgressById };
            delete nextProg[id];
            return {
              downloadProgressById: nextProg,
              downloadErrorById: { ...s.downloadErrorById, [id]: msg },
            };
          });
          try {
            const dest = audioFilePathForId(id);
            const info = await getInfoAsync(dest);
            if (info.exists) await deleteAsync(dest);
          } catch {
            /* ignore */
          }
        }
      },

      removeDownload: async (id: string) => {
        const e = get().entries[id];
        if (!e) return;
        try {
          if (e.audioPath) {
            const a = await getInfoAsync(e.audioPath);
            if (a.exists) await deleteAsync(e.audioPath);
          }
        } catch {
          /* ignore */
        }
        try {
          if (e.imagePath) {
            const im = await getInfoAsync(e.imagePath);
            if (im.exists) await deleteAsync(e.imagePath);
          }
        } catch {
          /* ignore */
        }
        set((s) => {
          const next = { ...s.entries };
          delete next[id];
          return { entries: next };
        });
      },
    }),
    {
      name: "offline-downloads",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ entries: s.entries }) as any,
    }
  )
);
