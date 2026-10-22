import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, useColorScheme } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { Session } from '@dayflow/shared';
import { native } from '../../modules/dayflow-native';
import * as runtime from './runtime';
import type { SyncSnapshot } from './sync';

export type Appearance = 'system' | 'light' | 'dark';
interface State { session: Session | null; ready: boolean; sync: SyncSnapshot; revision: number; dark: boolean; appearance: Appearance; setAppearance(value: Appearance): void }
const Context = createContext<State | null>(null);
export function Provider({ children }: PropsWithChildren) {
  const session = useSyncExternalStore(runtime.observe, runtime.currentSession);
  const sync = useSyncExternalStore(runtime.observe, runtime.currentSync);
  const [ready, setReady] = useState(false), [revision, setRevision] = useState(0);
  const [themeChoice, setThemeChoice] = useState<{ user: string | null; value: Appearance }>({ user: null, value: 'system' });
  const appearance = themeChoice.user === (session?.user.id ?? null) ? themeChoice.value : 'system';
  const system = useColorScheme();
  useEffect(() => {
    void runtime.initialize().then(() => setReady(true));
    const subscription = native.addListener('changed', () => setRevision(value => value + 1));
    const visible = (active: boolean) => { void native.appVisible(active); if (active) { runtime.retainSync('app'); runtime.syncNow(); } else runtime.releaseSync('app'); };
    visible(AppState.currentState === 'active');
    const appState = AppState.addEventListener('change', value => visible(value === 'active'));
    return () => { subscription.remove(); appState.remove(); runtime.releaseSync('app'); void native.appVisible(false); };
  }, []);
  useEffect(() => {
    if (!session) return;
    const current = runtime.accountReadGuard(session.user.id); let mounted = true;
    void native.meta(session.user.id, 'appearance').then(value => { if (mounted && current() && (value === 'system' || value === 'light' || value === 'dark')) setThemeChoice({ user: session.user.id, value }); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [session]);
  const changeAppearance = (value: Appearance) => { setThemeChoice({ user: session?.user.id ?? null, value }); if (session) void native.setMeta(session.user.id, 'appearance', value).catch(() => undefined); };
  return <Context value={{ session, ready, sync, revision, appearance, setAppearance: changeAppearance, dark: appearance === 'system' ? system === 'dark' : appearance === 'dark' }}>{children}</Context>;
}
export function useDayflow() { const value = useContext(Context); if (!value) throw new Error('Dayflow provider missing'); return value; }
export function usePalette() { const { dark } = useDayflow(); return dark ? { bg: '#10141D', card: '#1D2533', text: '#F3F4F6', muted: '#B1BDCF', line: '#334155', accent: '#A5B4FC' } : { bg: '#F5F6FA', card: '#FFFFFF', text: '#172033', muted: '#5A677D', line: '#DBE1EA', accent: '#304FC4' }; }
