import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { usePalette } from '../../lib/context';
export default function Layout() {
  const c = usePalette();
  return <Tabs screenOptions={{ headerStyle: { backgroundColor: c.card }, headerTintColor: c.text, tabBarStyle: { backgroundColor: c.card }, tabBarActiveTintColor: c.accent }}>
    <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>✓</Text> }} />
    <Tabs.Screen name="notes" options={{ title: 'Notes', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>▤</Text> }} />
    <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>◷</Text> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⚙</Text> }} />
  </Tabs>;
}
