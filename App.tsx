import React, { useCallback, useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { rootNavigationRef } from "./src/navigation/rootNavigationRef";
import MiniPlayer from "./src/components/MiniPlayer";
import PlaybackController from "./src/components/PlaybackController";
import { configurePlaybackAudioMode } from "./src/audio/configurePlaybackAudioMode";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#09090b",
    card: "#09090b",
    text: "#fafafa",
    border: "#18181b",
    primary: "#6366f1",
  },
};

export default function App() {
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>();

  useEffect(() => {
    void configurePlaybackAudioMode();
  }, []);

  const syncActiveRoute = useCallback(() => {
    const name = rootNavigationRef.getCurrentRoute()?.name;
    setCurrentRouteName(name);
  }, []);

  const showMiniPlayer = currentRouteName !== "Player";

  return (
    <NavigationContainer
      ref={rootNavigationRef}
      theme={appTheme}
      onReady={syncActiveRoute}
      onStateChange={syncActiveRoute}
    >
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PlaybackController />
          <AppNavigator />
          {showMiniPlayer ? <MiniPlayer /> : null}
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </NavigationContainer>
  );
}
