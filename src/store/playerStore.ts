import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { shuffleArray } from "./shuffleArray";

export type PlaybackContext = {
  kind: "playlist" | "album";
  id: string;
  originalSongs: any[];
};

type PlayerState = {
  currentSong: any;
  queue: any[];
  currentIndex: number;
  isPlaying: boolean;
  sound: any;
  positionMillis: number;
  durationMillis: number;
  skipPlaybackSyncUntil: number;
  committedSeekMillis: number | null;
  pendingSmoothDismissPlayer: boolean;
  /** Album/playlist source for shuffle; not persisted. */
  playbackContext: PlaybackContext | null;
  shuffleEnabled: boolean;
  /** Repeat: loop single (no context) or restart album/playlist when last track ends. */
  autoPlayEnabled: boolean;
  /** Ad-hoc queue + auto: frozen queue and index when auto was turned on (nextSong shrinks queue). */
  autoQueueSnapshot: any[] | null;
  autoQueueAnchorIndex: number;
  /** Bumped when the same queue slot must reload (e.g. auto-loop same track). */
  playbackReloadNonce: number;
  /** Next PlaybackController run skips reload when only queue order changed for the same track. */
  suppressNextAudioReload: boolean;
};

type PlayerActions = {
  setPlaybackProgress: (positionMillis: number, durationMillis: number) => void;
  commitSeekProgress: (positionMillis: number, durationMillis: number) => void;
  applyPlaybackStatus: (
    positionMillis: number,
    durationMillis: number
  ) => void;
  setQueue: (songs: any[]) => void;
  addToQueue: (song: any) => void;
  removeFromQueueById: (id: string) => void;
  removeFromQueueAtIndex: (index: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  playNowKeepQueue: (song: any) => void;
  setSong: (song: any, index: number) => void;
  setSound: (sound: any) => void;
  clearPlaybackAtEnd: () => void;
  play: () => void;
  pause: () => void;
  nextSong: () => void;
  prevSong: () => void;
  setPlaybackContext: (ctx: PlaybackContext | null) => void;
  clearPlaybackContext: () => void;
  setAutoPlayEnabled: (v: boolean) => void;
  toggleShuffle: () => void;
};

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      currentSong: null,
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      sound: null,
      positionMillis: 0,
      durationMillis: 0,
      skipPlaybackSyncUntil: 0,
      committedSeekMillis: null,
      pendingSmoothDismissPlayer: false,
      playbackContext: null,
      shuffleEnabled: false,
      autoPlayEnabled: false,
      autoQueueSnapshot: null,
      autoQueueAnchorIndex: 0,
      playbackReloadNonce: 0,
      suppressNextAudioReload: false,

      setPlaybackContext: (ctx: PlaybackContext | null) =>
        set({
          playbackContext: ctx,
          shuffleEnabled: false,
          autoQueueSnapshot: null,
          autoQueueAnchorIndex: 0,
          suppressNextAudioReload: false,
        }),

      clearPlaybackContext: () =>
        set({
          playbackContext: null,
          shuffleEnabled: false,
          autoQueueSnapshot: null,
          autoQueueAnchorIndex: 0,
          suppressNextAudioReload: false,
        }),

      setAutoPlayEnabled: (v: boolean) =>
        set((state: any) => {
          if (!v) {
            return {
              autoPlayEnabled: false,
              autoQueueSnapshot: null,
              autoQueueAnchorIndex: 0,
            };
          }
          const q = state.queue ?? [];
          if (!q.length) {
            return { autoPlayEnabled: true };
          }
          const i = Math.min(
            Math.max(0, state.currentIndex),
            q.length - 1
          );
          return {
            autoPlayEnabled: true,
            autoQueueSnapshot: [...q],
            autoQueueAnchorIndex: i,
          };
        }),

      /** Shuffle on/off using album/playlist `originalSongs` (not for ad-hoc queue). */
      toggleShuffle: () =>
        set((state: any) => {
          if (!state.playbackContext?.originalSongs?.length) return state;
          const orig = state.playbackContext.originalSongs;
          const cur = state.currentSong;
          const curId = cur != null ? String(cur.id) : "";

          const resetProgress = {
            positionMillis: 0,
            durationMillis: 0,
            committedSeekMillis: null,
            skipPlaybackSyncUntil: 0,
            pendingSmoothDismissPlayer: false,
          };

          if (state.shuffleEnabled) {
            const origIdx = Math.max(
              0,
              orig.findIndex((s: any) => String(s.id) === curId)
            );
            const queue = orig.slice(origIdx);
            const sameTrack =
              queue.length > 0 && String(queue[0]?.id ?? "") === curId;
            return {
              shuffleEnabled: false,
              queue,
              currentIndex: 0,
              currentSong: cur,
              suppressNextAudioReload: sameTrack,
              ...(sameTrack ? {} : resetProgress),
            };
          }

          const shuffled = shuffleArray(orig);
          const idx = Math.max(
            0,
            shuffled.findIndex((s: any) => String(s.id) === curId)
          );
          const picked = shuffled[idx] as { id?: string } | undefined;
          const sameTrack = Boolean(picked && String(picked.id) === curId);
          return {
            shuffleEnabled: true,
            queue: shuffled,
            currentIndex: idx,
            currentSong: sameTrack ? cur : picked,
            suppressNextAudioReload: Boolean(sameTrack),
            ...(sameTrack ? {} : resetProgress),
          };
        }),

      setPlaybackProgress: (positionMillis: number, durationMillis: number) =>
        set({
          positionMillis,
          durationMillis,
          committedSeekMillis: null,
          skipPlaybackSyncUntil: 0,
        }),

      commitSeekProgress: (positionMillis: number, durationMillis: number) =>
        set({
          positionMillis,
          durationMillis,
          committedSeekMillis: positionMillis,
          skipPlaybackSyncUntil: Date.now() + 480,
        }),

      applyPlaybackStatus: (positionMillis: number, durationMillis: number) =>
        set((state: any) => {
          const now = Date.now();
          if (
            state.committedSeekMillis != null &&
            now < state.skipPlaybackSyncUntil
          ) {
            const drift = Math.abs(positionMillis - state.committedSeekMillis);
            if (drift > 350) {
              return { durationMillis };
            }
          }
          return {
            positionMillis,
            durationMillis,
            committedSeekMillis: null,
            skipPlaybackSyncUntil: 0,
          };
        }),

      setQueue: (songs: any[]) =>
        set({
          queue: songs,
          autoQueueSnapshot: null,
          autoQueueAnchorIndex: 0,
          suppressNextAudioReload: false,
        }),

      /** Append song to end (duplicates allowed). If queue was empty and nothing playing, start this track. */
      addToQueue: (song: any) =>
        set((state: any) => {
          const id = String(song?.id ?? "");
          if (!id) return state;
          const nextQueue = [...state.queue, song];
          const idle = state.queue.length === 0 && state.currentSong == null;

          let clearCtx = false;
          if (state.playbackContext?.originalSongs?.length) {
            const allowed = new Set(
              state.playbackContext.originalSongs.map((s: any) =>
                String(s?.id ?? "")
              )
            );
            if (!allowed.has(id)) clearCtx = true;
          }

          const snapExtend =
            state.autoPlayEnabled &&
            Array.isArray(state.autoQueueSnapshot) &&
            state.autoQueueSnapshot.length > 0
              ? { autoQueueSnapshot: [...state.autoQueueSnapshot, song] }
              : {};

          if (!idle) {
            if (clearCtx) {
              return {
                queue: nextQueue,
                playbackContext: null,
                shuffleEnabled: false,
                autoQueueSnapshot: null,
                autoQueueAnchorIndex: 0,
              };
            }
            return { queue: nextQueue, ...snapExtend };
          }

          return {
            queue: nextQueue,
            currentSong: song,
            currentIndex: 0,
            positionMillis: 0,
            durationMillis: 0,
            committedSeekMillis: null,
            skipPlaybackSyncUntil: 0,
            pendingSmoothDismissPlayer: false,
            ...(clearCtx
              ? {
                  playbackContext: null,
                  shuffleEnabled: false,
                  autoQueueSnapshot: null,
                  autoQueueAnchorIndex: 0,
                }
              : {}),
            ...(!clearCtx ? snapExtend : {}),
          };
        }),

      /** Play this track now without replacing the whole queue (replaces "now playing" slot). */
      playNowKeepQueue: (song: any) =>
        set((state: any) => {
          const id = String(song?.id ?? "");
          if (!id) return state;
          const reset = {
            positionMillis: 0,
            durationMillis: 0,
            committedSeekMillis: null,
            skipPlaybackSyncUntil: 0,
            pendingSmoothDismissPlayer: false,
          };
          const q = state.queue;
          if (!q.length) {
            return {
              queue: [song],
              currentSong: song,
              currentIndex: 0,
              ...reset,
              autoQueueSnapshot: null,
              autoQueueAnchorIndex: 0,
            };
          }
          const idx = Math.min(Math.max(0, state.currentIndex), q.length - 1);
          const next = [...q];
          next[idx] = song;
          return {
            queue: next,
            currentSong: song,
            currentIndex: idx,
            ...reset,
            autoQueueSnapshot: null,
            autoQueueAnchorIndex: 0,
          };
        }),

      removeFromQueueById: (id: string) =>
        set((state: any) => {
          const idStr = String(id);
          const oldQueue = state.queue;
          const oldIdx = oldQueue.findIndex(
            (s: any) => String(s.id) === idStr
          );
          if (oldIdx < 0) return state;
          const newQueue = oldQueue.filter((s: any) => String(s.id) !== idStr);
          const curId = state.currentSong?.id;
          let newIndex = state.currentIndex;
          let newCurrent = state.currentSong;
          if (String(curId) === idStr) {
            if (newQueue.length === 0) {
              newIndex = 0;
              newCurrent = null;
            } else {
              newIndex = Math.min(oldIdx, newQueue.length - 1);
              newCurrent = newQueue[newIndex];
            }
          } else {
            const newIdx =
              oldIdx < state.currentIndex
                ? state.currentIndex - 1
                : state.currentIndex;
            return {
              queue: newQueue,
              currentIndex: Math.max(0, newIdx),
              currentSong: state.currentSong,
              autoQueueSnapshot: null,
              autoQueueAnchorIndex: 0,
            };
          }
          return {
            queue: newQueue,
            currentIndex: Math.max(0, newIndex),
            currentSong: newCurrent,
            autoQueueSnapshot: null,
            autoQueueAnchorIndex: 0,
          };
        }),

      removeFromQueueAtIndex: (removeIndex: number) =>
        set((state: any) => {
          const oldQueue = state.queue;
          if (removeIndex < 0 || removeIndex >= oldQueue.length) return state;
          const newQueue = oldQueue.filter(
            (_s: unknown, i: number) => i !== removeIndex
          );
          const wasCurrent = state.currentIndex === removeIndex;
          if (wasCurrent) {
            if (newQueue.length === 0) {
              return {
                queue: [],
                currentIndex: 0,
                currentSong: null,
                autoQueueSnapshot: null,
                autoQueueAnchorIndex: 0,
              };
            }
            const newIndex = Math.min(removeIndex, newQueue.length - 1);
            return {
              queue: newQueue,
              currentIndex: newIndex,
              currentSong: newQueue[newIndex],
              autoQueueSnapshot: null,
              autoQueueAnchorIndex: 0,
            };
          }
          const newIdx =
            removeIndex < state.currentIndex
              ? state.currentIndex - 1
              : state.currentIndex;
          return {
            queue: newQueue,
            currentIndex: Math.max(0, newIdx),
            currentSong: state.currentSong,
            autoQueueSnapshot: null,
            autoQueueAnchorIndex: 0,
          };
        }),

      moveQueueItem: (fromIndex: number, toIndex: number) =>
        set((state: any) => {
          const q = [...state.queue];
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= q.length ||
            toIndex >= q.length
          ) {
            return state;
          }
          const playIdx = state.currentIndex;
          let newPlayIdx = playIdx;
          if (fromIndex < toIndex) {
            if (playIdx === fromIndex) newPlayIdx = toIndex;
            else if (playIdx > fromIndex && playIdx <= toIndex) newPlayIdx--;
          } else {
            if (playIdx === fromIndex) newPlayIdx = toIndex;
            else if (playIdx < fromIndex && playIdx >= toIndex) newPlayIdx++;
          }
          const [item] = q.splice(fromIndex, 1);
          q.splice(toIndex, 0, item);
          newPlayIdx = Math.max(0, Math.min(newPlayIdx, q.length - 1));
          return {
            queue: q,
            currentIndex: newPlayIdx,
            currentSong: q[newPlayIdx] ?? state.currentSong,
            autoQueueSnapshot: null,
            autoQueueAnchorIndex: 0,
          };
        }),

      setSong: (song: any, index: number) =>
        set({
          currentSong: song,
          currentIndex: index,
          positionMillis: 0,
          durationMillis: 0,
          committedSeekMillis: null,
          skipPlaybackSyncUntil: 0,
          pendingSmoothDismissPlayer: false,
          autoQueueSnapshot: null,
          autoQueueAnchorIndex: 0,
        }),

      setSound: (sound: any) => set({ sound }),

      clearPlaybackAtEnd: () =>
        set({
          currentSong: null,
          sound: null,
          isPlaying: false,
          positionMillis: 0,
          durationMillis: 0,
          committedSeekMillis: null,
          skipPlaybackSyncUntil: 0,
          pendingSmoothDismissPlayer: false,
          autoQueueSnapshot: null,
          autoQueueAnchorIndex: 0,
          suppressNextAudioReload: false,
        }),

      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),

      /** Advance to next track and remove the track we leave (no longer in queue). */
      nextSong: () =>
        set((state: any) => {
          const q = state.queue;
          const i = state.currentIndex;
          if (i + 1 >= q.length) return state;

          const newQueue = q.filter((_s: unknown, idx: number) => idx !== i);
          const newSong = newQueue[i];
          if (!newSong) return state;

          return {
            queue: newQueue,
            currentIndex: i,
            currentSong: newSong,
            positionMillis: 0,
            durationMillis: 0,
            committedSeekMillis: null,
            skipPlaybackSyncUntil: 0,
          };
        }),

      prevSong: () =>
        set((state: any) => {
          const prevIndex = state.currentIndex - 1;

          if (prevIndex < 0) return state;

          return {
            currentIndex: prevIndex,
            currentSong: state.queue[prevIndex],
            positionMillis: 0,
            durationMillis: 0,
            committedSeekMillis: null,
            skipPlaybackSyncUntil: 0,
          };
        }),
    }),
    {
      name: "player-queue",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state: PlayerState & PlayerActions) => ({ queue: state.queue }),
    }
  )
);
