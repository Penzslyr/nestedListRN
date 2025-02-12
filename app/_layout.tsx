import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: "Nested List",
        headerStyle: {
          backgroundColor: "#fff",
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: "600",
        },
        headerShadowVisible: true, // Adds a subtle shadow under the header
      }}
    />
  );
}
