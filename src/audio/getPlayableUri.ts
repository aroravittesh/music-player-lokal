import { getInfoAsync } from "expo-file-system/legacy";
import { useDownloadsStore } from "../store/downloadsStore";

/** Remote stream URL from API song object (Saavn-style). */
export function getRemoteStreamUrl(song: any): string | null {
  if (!song?.downloadUrl) return null;
  const urlObj =
    song.downloadUrl.find((u: any) => u.quality === "320kbps") ||
    song.downloadUrl[0];
  return urlObj?.link || urlObj?.url || null;
}

/**
 * Prefer verified on-disk file for this track id; otherwise remote stream URL.
 */
export async function resolvePlayableUriAsync(song: any): Promise<string | null> {
  const id = song?.id != null ? String(song.id) : "";
  if (id) {
    const local = useDownloadsStore.getState().getLocalAudioPath(id);
    if (local) {
      try {
        const info = await getInfoAsync(local);
        if (info.exists) return local;
      } catch {
        /* fall through */
      }
    }
  }
  return getRemoteStreamUrl(song);
}
