import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDayflow, usePalette } from '../lib/context';
import { Login } from '../components/Login';
import { Loading } from '../components/ui';
function Routes() {
  const { session, ready, dark } = useDayflow(); const c = usePalette();
  if (!ready) return <Loading />;
  return <><StatusBar style={dark ? 'light' : 'dark'} />{session ? <Stack screenOptions={{ headerStyle: { backgroundColor: c.card }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg } }}><Stack.Screen name="(tabs)" options={{ headerShown: false }} /><Stack.Screen name="editor" options={{ title: 'Editor', presentation: 'modal' }} /><Stack.Screen name="capture" options={{ title: 'Save to Dayflow', presentation: 'modal' }} /></Stack> : <Login />}</>;
}
export default function Layout() { return <SafeAreaProvider><Provider><Routes /></Provider></SafeAreaProvider>; }
