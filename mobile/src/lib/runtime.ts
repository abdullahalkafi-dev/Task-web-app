import { AppRegistry } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@dayflow/shared';
import { native } from '../../modules/dayflow-native';
import { initialSync, SyncEngine, type SyncSnapshot } from './sync';
import { flushDrafts } from './drafts';

const SESSION_KEY = 'dayflow.session';
let session: Session | null = null;
let initialized: Promise<Session | null> | null = null;
let engine: SyncEngine | null = null;
let snapshot = initialSync;
const listeners = new Set<() => void>();
const owners = new Set<string>();
let overlayTask = 0;
let sessionEpoch = 0, sessionTransitions = 0;
export function observe(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }
export const currentSession = () => session;
export const currentSync = (): SyncSnapshot => snapshot;
export function accountReadGuard(user: string) {
  const epoch = sessionEpoch;
  return () => sessionTransitions === 0 && sessionEpoch === epoch && session?.user.id === user;
}
function emit() { listeners.forEach(listener => listener()); }
function restart() {
  engine?.stop(); engine = null;
  if (session && owners.size) { engine = new SyncEngine(session, value => { snapshot = value; emit(); }); engine.start(); }
}
export function initialize() {
  initialized ??= (async () => {
    const saved = (__DEV__ ? await native.testSession() : null) ?? await SecureStore.getItemAsync(SESSION_KEY);
    if (saved) { try { session = JSON.parse(saved) as Session; if (!session?.token || !session?.user?.id) session = null; } catch { session = null; } }
    await native.activate(session?.user.id ?? null); restart(); emit(); return session;
  })();
  return initialized;
}
export async function setSession(next: Session | null) {
  sessionTransitions++; sessionEpoch++;
  try {
  await flushDrafts();
  engine?.stop(); engine = null;
  await native.activate(null);
  const previous = session;
  try {
    if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next)); else await SecureStore.deleteItemAsync(SESSION_KEY);
    await native.activate(next?.user.id ?? null);
    session = next; snapshot = initialSync; restart(); emit();
  } catch (error) {
    if (previous) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(previous)); else await SecureStore.deleteItemAsync(SESSION_KEY);
    await native.activate(previous?.user.id ?? null); restart(); throw error;
  }
  } finally { sessionTransitions--; }
}
export function retainSync(owner: string) { const was = owners.size; owners.add(owner); if (!was) restart(); }
export function releaseSync(owner: string) { owners.delete(owner); if (!owners.size) { engine?.stop(); engine = null; } }
export function syncNow() { engine?.trigger(); }
AppRegistry.registerHeadlessTask('DayflowOverlaySync', () => async () => {
  const owner = `overlay:${++overlayTask}`;
  await initialize(); retainSync(owner);
  try { while (await native.bubbleActive()) await new Promise(resolve => setTimeout(resolve, 1000)); }
  finally { releaseSync(owner); }
});
