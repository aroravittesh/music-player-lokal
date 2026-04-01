import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from "expo-av";

/**
 * Call once at app launch (and after any audio mode reset).
 * iOS requires `UIBackgroundModes: audio` in app config + `playsInSilentModeIOS`
 * when using `staysActiveInBackground`.
 */
export async function configurePlaybackAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.warn("configurePlaybackAudioMode:", e);
  }
}
