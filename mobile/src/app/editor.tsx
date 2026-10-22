import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, KeyboardAvoidingView, Platform } from 'react-native';
import { router, Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { fromReminderInput, nextStamp, STATUS_LABEL, STATUS_ORDER, toReminderInput, type Document, type Entity, type TaskDoc, type TaskStatus } from '@dayflow/shared';
import { native, repository } from '../../modules/dayflow-native';
import { useDayflow } from '../lib/context';
import { RichEditor, type Content, type EditorHandle } from '../components/RichEditor';
import { randomUUID } from 'expo-crypto';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { persistDraft } from '../lib/drafts';
import { Body, Button, Heading, Input, Loading, Row, Screen } from '../components/ui';

interface Draft { id: string; title: string; html: string; text: string; estimate: string; status: TaskStatus; reminder: string; base: string | null }
export default function EditorScreen() {
  const params = useLocalSearchParams<{ id?: string; entity?: string }>(); const entity: Entity = params.entity === 'note' ? 'note' : 'task';
  const { session, revision, sync } = useDayflow();
  const [id] = useState(() => params.id ?? randomUUID()); const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''); const editor = useRef<EditorHandle>(null);
  const latest = useRef<Draft | null>(null), loaded = useRef(false), closing = useRef(false), saved = useRef(false), dirty = useRef(false);
  const [preventLeave, setPreventLeave] = useState(false);
  const [localStatus, setLocalStatus] = useState('Local copy'); const draftSequence = useRef(0);
  const key = `draft:${entity}:${id}`;
  useEffect(() => {
    if (!session || loaded.current) return; loaded.current = true;
    void (async () => {
      const rows = await repository.list(session.user.id, entity); const doc = rows.find(d => d.id === id);
      const stored = await native.meta(session.user.id, key);
      const initial: Draft = { id, title: doc?.title ?? '', html: doc?.descriptionHtml ?? '', text: doc?.descriptionText ?? '', estimate: String((doc as TaskDoc | undefined)?.estimatedMinutes ?? 0), status: (doc as TaskDoc | undefined)?.status ?? 'notStarted', reminder: toReminderInput((doc as TaskDoc | undefined)?.reminderAt), base: doc?.updatedAt ?? null };
      if (stored) { const restored = JSON.parse(stored) as Draft; latest.current = restored; setDraft(restored); dirty.current = true; setPreventLeave(true); setNotice(restored.base !== (doc?.updatedAt ?? null) ? 'This item changed elsewhere. Review your restored draft before saving.' : 'Draft restored from this device.'); }
      else { latest.current = initial; setDraft(initial); if (params.id && (!doc || doc.deletedAt)) setNotice('This item was deleted elsewhere. Save will create a new copy.'); }
    })().catch(e => setError(String(e)));
  }, [session, entity, id, key, params.id]);
  async function persist(value: Draft) { if (session && !saved.current) await persistDraft(session.user.id, key, JSON.stringify(value)); }
  function update(patch: Partial<Draft>) { if (!latest.current || saved.current || closing.current) return; dirty.current = true; setPreventLeave(true); const next = { ...latest.current, ...patch }; latest.current = next; setDraft(next); const sequence = ++draftSequence.current; setLocalStatus('Saving draft…'); void persist(next).then(() => { if (sequence === draftSequence.current) setLocalStatus('Draft saved on this device'); }).catch(e => { setLocalStatus('Draft could not be saved'); setError(String(e)); }); }
  useEffect(() => {
    if (!session || !draft?.base) return;
    void repository.list(session.user.id, entity).then(rows => { const remote = rows.find(d => d.id === id); if (!remote || remote.deletedAt) setNotice('This item was deleted elsewhere. Save will create a new copy.'); else if (remote.updatedAt !== draft.base) setNotice('This item changed elsewhere. Your current draft is retained; saving applies your draft as a new edit.'); });
  }, [revision, session, entity, id, draft?.base]);
  async function flushDraft() {
    if (!latest.current) return;
    const content = await editor.current?.flush(); const value = { ...latest.current, ...(content ? { html: content.html, text: content.text } : {}) };
    latest.current = value; if (dirty.current) await persist(value); return value;
  }
  const disablePrevention = usePreventRemove(preventLeave, ({ repeat }) => {
    if (busy) return;
    if (closing.current) { repeat(); return; }
    void flushDraft().then(() => { closing.current = true; setPreventLeave(false); repeat(); }).catch(e => setError(String(e)));
  });
  useEffect(() => {
    const state = AppState.addEventListener('change', value => { if (value !== 'active') void flushDraft().catch(e => setError(String(e))); });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (busy) return true; return false; });
    return () => { state.remove(); back.remove(); if (latest.current && dirty.current && !saved.current) void persist(latest.current); };
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!session || busy) return; setBusy(true); setError('');
    try {
      const value = await flushDraft(); if (!value) throw new Error('Editor is still loading');
      if (!value.title.trim()) throw new Error('Give this item a title.');
      const reminderAt = entity === 'task' ? fromReminderInput(value.reminder) : null;
      const rows = await repository.list(session.user.id, entity); const previous = rows.find(d => d.id === id);
      const patch: Partial<Document> & { localImageSourceId?: string } = { id: previous?.deletedAt || (value.base && !previous) ? randomUUID() : id, title: value.title, descriptionHtml: value.html, descriptionText: value.text };
      if (patch.id !== id) patch.localImageSourceId = id;
      if (entity === 'task') Object.assign(patch, { estimatedMinutes: Math.floor(Math.max(0, Math.min(1439, Number(value.estimate) || 0))), status: value.status, reminderAt });
      await repository.mutate(session.user.id, entity, patch); saved.current = true; setPreventLeave(false); disablePrevention(); await persistDraft(session.user.id, key, null); router.back();
    } catch (e) { saved.current = false; setPreventLeave(dirty.current); setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  function remove() { Alert.alert('Delete this item?', 'Saved items are deleted from your other devices after sync. An unfinished draft is removed from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
    if (!session || busy) return;
    setBusy(true);
    void (async () => {
      const rows = await repository.list(session.user.id, entity);
      if (rows.some(doc => doc.id === id && !doc.deletedAt)) await repository.mutate(session.user.id, entity, { id, deletedAt: nextStamp() });
      saved.current = true; setPreventLeave(false); disablePrevention(); await persistDraft(session.user.id, key, null); router.back();
    })().catch(e => { saved.current = false; setPreventLeave(dirty.current); setError(String(e)); }).finally(() => setBusy(false));
  } }]); }
  async function pickReminder() {
    const value = latest.current?.reminder ? new Date(fromReminderInput(latest.current.reminder)!) : new Date(Date.now() + 3600000);
    DateTimePickerAndroid.open({ value, mode: 'date', timeZoneName: 'Asia/Dhaka', onChange: (event, date) => {
      if (event.type !== 'set' || !date) return;
      DateTimePickerAndroid.open({ value: date, mode: 'time', is24Hour: false, timeZoneName: 'Asia/Dhaka', onChange: (timeEvent, selected) => {
        if (timeEvent.type !== 'set' || !selected) return;
        update({ reminder: toReminderInput(selected.toISOString()) });
        void native.permissions().then(permissions => { if (!permissions.notifications) return native.requestPermission('notifications'); }).catch(e => setError(String(e)));
      } });
    } });
  }
  if (!draft) return error ? <Screen><Body>{error}</Body></Screen> : <Loading />;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Stack.Screen options={{ title: entity === 'task' ? 'Task' : 'Note', headerRight: () => <Button title={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={() => void save()} /> }} /><Screen><Heading>{entity === 'task' ? 'Task' : 'Note'}</Heading>{notice ? <Body>{notice}</Body> : null}<Input accessibilityLabel="Title" placeholder={entity === 'task' ? 'Task title' : 'Note title'} maxLength={200} value={draft.title} onChangeText={title => update({ title })} /><RichEditor ref={editor} html={draft.html} entity={entity} entityId={id} onChange={(content: Content) => update({ html: content.html, text: content.text })} />
    {entity === 'task' ? <><Body>Estimated minutes</Body><Input accessibilityLabel="Estimated minutes" keyboardType="number-pad" value={draft.estimate} onChangeText={estimate => update({ estimate })} /><Row>{STATUS_ORDER.map(status => <Button key={status} subtle={status !== draft.status} title={STATUS_LABEL[status]} onPress={() => update({ status })} />)}</Row><Body>Reminder · Dhaka time</Body><Button subtle title={draft.reminder ? draft.reminder.replace('T', ' at ') : 'Choose date and time'} onPress={() => void pickReminder().catch(e => setError(String(e)))} /><Button subtle title="Clear reminder" onPress={() => update({ reminder: '' })} /><Body muted>Enable precise timing in Settings for exact reminders. Otherwise Android may delay them.</Body></> : null}
    <Body muted>{localStatus} · {sync.state}</Body>{error ? <Body>{error}</Body> : null}<Button title={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={() => void save()} />{params.id ? <Button subtle title="Delete" onPress={remove} /> : null}</Screen></KeyboardAvoidingView>;
}
