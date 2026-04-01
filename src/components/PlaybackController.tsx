import { useEffect } from "react";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { usePlayerStore } from "../store/playerStore";
import { rootNavigationRef } from "../navigation/rootNavigationRef";
import { shuffleArray } from "../store/shuffleArray";
import { resolvePlayableUriAsync } from "../audio/getPlayableUri";

/**
 * Loads and plays the current queue item when `currentSong` or `currentIndex`
 * changes (index is needed when the same object appears twice in the queue).
 */
export default function PlaybackController() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const playbackReloadNonce = usePlayerStore((s) => s.playbackReloadNonce);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      const stSkip = usePlayerStore.getState();
      if (stSkip.suppressNextAudioReload && stSkip.sound && currentSong) {
        const keepUri = await resolvePlayableUriAsync(currentSong);
        if (keepUri) {
          usePlayerStore.setState({ suppressNextAudioReload: false });
          return;
        }
      }
      if (stSkip.suppressNextAudioReload) {
        usePlayerStore.setState({ suppressNextAudioReload: false });
      }

      const {
        sound: prevSound,
        setSound,
        pause,
        setPlaybackProgress,
      } = usePlayerStore.getState();

      if (!currentSong) {
        if (prevSound) {
          prevSound.setOnPlaybackStatusUpdate(null);
          try {
            await prevSound.unloadAsync();
          } catch (_) {}
          if (isActive) {
            setSound(null);
            pause();
            setPlaybackProgress(0, 0);
          }
        }
        return;
      }

      const url = await resolvePlayableUriAsync(currentSong);
      if (!url) return;

      try {
        const { play } = usePlayerStore.getState();

        if (prevSound) {
          prevSound.setOnPlaybackStatusUpdate(null);
          await prevSound.stopAsync();
          await prevSound.unloadAsync();
        }

        setPlaybackProgress(0, 0);

        const { sound: newSound } = await Audio.Sound.createAsync({
          uri: url,
        });

        if (!isActive) {
          await newSound.unloadAsync();
          return;
        }

        let finishHandled = false;
        const onStatus = (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          usePlayerStore.getState().applyPlaybackStatus(
            status.positionMillis,
            status.durationMillis ?? 0
          );

          if (finishHandled) return;

          const dur = status.durationMillis ?? 0;
          const pos = status.positionMillis;
          const buffering = Boolean(status.isBuffering);
          const atEndFence =
            dur >= 2000 &&
            pos > 500 &&
            !status.isPlaying &&
            !buffering &&
            pos >= dur - 200 &&
            pos <= dur + 2000;
          const songEnded = Boolean(status.didJustFinish || atEndFence);
          if (!songEnded) return;
          finishHandled = true;

          const st = usePlayerStore.getState();
          const endedSound = st.sound;
          const hasNext = st.currentIndex + 1 < st.queue.length;
          if (hasNext) {
            st.nextSong();
            return;
          }

          const auto = st.autoPlayEnabled;
          const ctx = st.playbackContext;

          if (auto && ctx?.originalSongs?.length && endedSound) {
            const songs = st.shuffleEnabled
              ? shuffleArray([...ctx.originalSongs])
              : [...ctx.originalSongs];
            endedSound.setOnPlaybackStatusUpdate(null);
            void (async () => {
              try {
                await endedSound.unloadAsync();
              } catch (_) {}
            })();
            usePlayerStore.setState((s: any) => ({
              queue: songs,
              currentIndex: 0,
              currentSong: songs[0],
              positionMillis: 0,
              durationMillis: 0,
              committedSeekMillis: null,
              skipPlaybackSyncUntil: 0,
              sound: null,
              isPlaying: false,
              playbackReloadNonce: (s.playbackReloadNonce ?? 0) + 1,
            }));
            return;
          }

          if (auto && !ctx && st.autoQueueSnapshot?.length && endedSound) {
            const snap = st.autoQueueSnapshot;
            const idx = Math.min(
              Math.max(0, st.autoQueueAnchorIndex),
              snap.length - 1
            );
            const loopSong = snap[idx] ?? snap[0];
            endedSound.setOnPlaybackStatusUpdate(null);
            void (async () => {
              try {
                await endedSound.unloadAsync();
              } catch (_) {}
            })();
            usePlayerStore.setState((s: any) => ({
              queue: [...snap],
              currentSong: loopSong,
              currentIndex: idx,
              positionMillis: 0,
              durationMillis: 0,
              committedSeekMillis: null,
              skipPlaybackSyncUntil: 0,
              sound: null,
              isPlaying: false,
              playbackReloadNonce: (s.playbackReloadNonce ?? 0) + 1,
            }));
            return;
          }

          usePlayerStore.setState((s: any) => {
            const i = s.currentIndex;
            const q = s.queue;
            if (i < 0 || i >= q.length) return {};
            return {
              queue: q.filter((_: unknown, idx: number) => idx !== i),
              currentIndex: 0,
            };
          });

          if (!endedSound) return;

          endedSound.setOnPlaybackStatusUpdate(null);
          void (async () => {
            try {
              await endedSound.unloadAsync();
            } catch (_) {}

            const onPlayerScreen =
              rootNavigationRef.isReady() &&
              rootNavigationRef.getCurrentRoute()?.name === "Player";

            if (onPlayerScreen) {
              usePlayerStore.setState({
                sound: null,
                isPlaying: false,
                pendingSmoothDismissPlayer: true,
              });
            } else {
              usePlayerStore.getState().clearPlaybackAtEnd();
            }
          })();
        };

        newSound.setOnPlaybackStatusUpdate(onStatus);
        await newSound.setProgressUpdateIntervalAsync(500);

        setSound(newSound);
        await newSound.playAsync();
        play();
      } catch (err) {
        console.log("PlaybackController error:", err);
      }
    };

    void run();

    return () => {
      isActive = false;
    };
  }, [currentSong, currentIndex, playbackReloadNonce]);

  return null;
}
