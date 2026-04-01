import { documentDirectory, makeDirectoryAsync } from "expo-file-system/legacy";

const root = documentDirectory ?? "";
export const OFFLINE_ROOT = `${root}offline/`;
export const OFFLINE_AUDIO_DIR = `${OFFLINE_ROOT}audio/`;
export const OFFLINE_COVERS_DIR = `${OFFLINE_ROOT}covers/`;

export function audioFilePathForId(id: string): string {
  return `${OFFLINE_AUDIO_DIR}${id}.m4a`;
}

export function coverFilePathForId(id: string): string {
  return `${OFFLINE_COVERS_DIR}${id}.jpg`;
}

export async function ensureOfflineDirs(): Promise<void> {
  await makeDirectoryAsync(OFFLINE_AUDIO_DIR, {
    intermediates: true,
  });
  await makeDirectoryAsync(OFFLINE_COVERS_DIR, {
    intermediates: true,
  });
}
