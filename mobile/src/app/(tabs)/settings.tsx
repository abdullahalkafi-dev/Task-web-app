import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import type { Document, Entity } from '@dayflow/shared';
import { native, repository, type Permissions } from '../../../modules/dayflow-native';
import { useDayflow } from '../../lib/context';
import { accountReadGuard, setSession, syncNow } from '../../lib/runtime';
import { copyPendingImages } from '../../lib/images';
import { Body, Button, Card, Heading, Row, Screen } from '../../components/ui';
const storageLabels: Record<string,string> = { databaseBytes: 'Local tasks, notes and drafts', pendingImageBytes: 'Unsynced images', cacheBytes: 'Downloaded images' };
export default function Settings() {
  const { session, sync, appearance, setAppearance, revision } = useDayflow();
  const [permissions, setPermissions] = useState<Permissions | null>(null), [storage, setStorage] = useState<Record<string, number>>({}), [recoveries, setRecoveries] = useState<{ key: string; doc: Document }[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; entity: Entity; title: string }[]>([]);
  const showError = (error: unknown) => Alert.alert('Dayflow', error instanceof Error ? error.message : String(error));
  async function refresh() {
    if (!session) return;
    const user = session.user.id, current = accountReadGuard(user);
    if (!current()) return;
    try {
      const [permissions, storage, recoveries, drafts] = await Promise.all([native.permissions(), native.storage(user), native.recoveries(user), native.drafts(user)]);
      if (!current()) return;
      setPermissions(permissions); setStorage(storage); setRecoveries(JSON.parse(recoveries)); setDrafts(JSON.parse(drafts));
    } catch (error) { if (current()) throw error; }
  }
  useEffect(() => { void Promise.resolve().then(refresh).catch(showError); const listener = AppState.addEventListener('change', value => { if (value === 'active') void refresh().catch(showError); }); return () => listener.remove(); }, [session, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  async function logout() { await setSession(null); await GoogleSignin.signOut().catch(() => undefined); }
  async function recover(item: { key: string; doc: Document }) { if (!session) return; const entity: Entity = 'taskDate' in item.doc ? 'task' : 'note'; const { id: _id, createdAt: _created, updatedAt: _updated, deletedAt: _deleted, userId: _user, ...copy } = item.doc; const id = randomUUID(); const descriptionHtml = await copyPendingImages(session.user.id, entity, id, copy.descriptionHtml); await repository.mutate(session.user.id, entity, { ...copy, id, descriptionHtml, ...(entity === 'task' ? { taskDate: undefined, reminderAt: null } : {}) }); await native.setMeta(session.user.id, item.key, null); await refresh(); }
  return <Screen><Heading>Settings</Heading><Card><Body>{session?.user.name ?? session?.user.email}</Body><Body muted>{sync.state} · {sync.pending} pending</Body>{sync.message ? <Body>{sync.message}</Body> : null}<Button title="Sync now" onPress={syncNow} /><Button subtle title="Sign out" onPress={() => Alert.alert('Sign out?', 'Local changes stay on this device for this account. Widgets and the bubble will be cleared.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => void logout().catch(showError) }])} /></Card>
    <Card><Body>Appearance</Body><Row>{(['system','light','dark'] as const).map(value => <Button key={value} title={value} subtle={appearance !== value} onPress={() => setAppearance(value)} />)}</Row></Card>
    <Card><Body>Floating task bubble</Body><Body muted>Shows a compact task panel above other apps. An ongoing notification lets you stop it. Enable it again after reboot or force-stop.</Body><Button subtle title={permissions?.overlay ? 'Overlay access allowed' : 'Allow display over other apps'} onPress={() => void native.requestPermission('overlay').catch(showError)} /><Button title={permissions?.bubble ? 'Stop bubble' : 'Enable bubble'} onPress={() => void native.setBubble(!permissions?.bubble).then(refresh).catch(showError)} /></Card>
    <Card><Body>Reminders</Body><Body muted>Set a reminder in a task. Downloaded reminders work offline; website changes arrive after sync.</Body><Button subtle title={permissions?.notifications ? 'Notifications allowed' : 'Allow notifications'} onPress={() => void native.requestPermission('notifications').catch(showError)} /><Button subtle title={permissions?.exactAlarms ? 'Precise timing allowed' : 'Allow precise reminder timing'} onPress={() => void native.requestPermission('exactAlarms').catch(showError)} /><Body muted>{permissions?.exactAlarms ? 'Precise alarms enabled.' : 'Android may delay reminders with approximate timing.'}</Body></Card>
    <Card><Body>Home-screen widget and sharing</Body><Button title="Add home-screen widget" onPress={() => void native.pinWidget().then(supported => { if (!supported) Alert.alert('Add the widget', 'Long-press your home screen, choose Widgets, then Dayflow.'); }).catch(showError)} /><Body muted>You can also long-press your home screen and choose Widgets, then Dayflow. Use another app’s Share button and choose Dayflow to capture text, links, or images.</Body></Card>
    {drafts.length ? <Card><Body>Unfinished drafts</Body>{drafts.map(draft => <Button subtle key={`${draft.entity}:${draft.id}`} title={draft.title || 'Untitled draft'} onPress={() => router.push({ pathname: '/editor', params: { entity: draft.entity, id: draft.id } })} />)}</Card> : null}
    {recoveries.length ? <Card><Body>Recoverable changes</Body>{recoveries.map(item => <Row key={item.key}><Body>{item.doc.title}</Body><Button subtle title="Copy as new" onPress={() => void recover(item).catch(showError)} /></Row>)}</Card> : null}
    <Card><Body>Storage</Body>{Object.entries(storage).map(([key, bytes]) => <Body muted key={key}>{storageLabels[key] ?? 'Other local data'}: {(bytes / 1000000).toFixed(1)} MB</Body>)}<Body muted>Downloaded image cache is limited to 100 MB. Pending image files are retained until their changes are safely acknowledged.</Body></Card><Body muted>Dayflow Android 1.0.0 · Private release · Dhaka time</Body></Screen>;
}
