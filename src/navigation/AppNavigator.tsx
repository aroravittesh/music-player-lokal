import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import PlayerScreen from "../screens/PlayerScreen";
import PlaylistScreen from "../screens/PlaylistScreen";
import AlbumScreen from "../screens/AlbumScreen";
import QueueScreen from "../screens/QueueScreen";
import DownloadsScreen from "../screens/DownloadsScreen";

const darkHeader = {
  backgroundColor: "#09090b",
};

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#09090b" },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="Player"
        component={PlayerScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="Playlist"
        component={PlaylistScreen}
        options={{
          headerShown: true,
          title: "Playlist",
          headerStyle: darkHeader,
          headerTintColor: "#fafafa",
          headerTitleStyle: { fontWeight: "700", fontSize: 17, color: "#fafafa" },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="Album"
        component={AlbumScreen}
        options={{
          headerShown: true,
          title: "Album",
          headerStyle: darkHeader,
          headerTintColor: "#fafafa",
          headerTitleStyle: { fontWeight: "700", fontSize: 17, color: "#fafafa" },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="Queue"
        component={QueueScreen}
        options={{
          headerShown: true,
          title: "Queue",
          headerStyle: darkHeader,
          headerTintColor: "#fafafa",
          headerTitleStyle: { fontWeight: "700", fontSize: 17, color: "#fafafa" },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="Downloads"
        component={DownloadsScreen}
        options={{
          headerShown: true,
          title: "Downloads",
          headerStyle: darkHeader,
          headerTintColor: "#fafafa",
          headerTitleStyle: { fontWeight: "700", fontSize: 17, color: "#fafafa" },
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}