import { useEffect, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { router } from 'expo-router';
import type { Entity } from '@dayflow/shared';
import { native, repository, type Incoming } from '../../modules/dayflow-native';
import { useDayflow } from '../lib/context';
import { Body, Button, Card, Heading, Screen } from '../components/ui';
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export default function Capture() {
  const { session, revision } = useDayflow(); const [items, setItems] = useState<Incoming[]>([]), [busy, setBusy] = useState(false);
  useEffect(() => { void native.incoming().then(raw => setItems(JSON.parse(raw))); }, [revision]);
  async function save(item: Incoming, entity: Entity) {
    if (!session || busy) return; setBusy(true);
    try {
      // Stable capture id makes reprocessing after a crash update the same document.
      const id = item.id;
      const chosen = await native.meta(session.user.id, `capture:${id}`);
      if (chosen === 'task' || chosen === 'note') entity = chosen;
      else await native.setMeta(session.user.id, `capture:${id}`, entity);
      if ((await repository.list(session.user.id, entity)).some(doc => doc.id === id)) { await native.consumeIncoming(id); router.replace({ pathname: '/editor', params: { entity, id } }); return; }
      let html = /^https?:\/\/\S+$/i.test(item.text.trim()) ? `<p><a href="${escapeHtml(item.text.trim())}">${escapeHtml(item.text.trim())}</a></p>` : item.text ? `<p>${escapeHtml(item.text).replace(/\n/g, '<br>')}</p>` : '';
      for (const image of item.images) { const queued = JSON.parse(await native.queueImage(session.user.id, entity, id, image.uri, image.mime)) as { localId: string }; html += `<img src="local:${queued.localId}" data-local-id="${queued.localId}">`; }
      await repository.mutate(session.user.id, entity, { id, title: item.title || item.text.split('\n')[0].slice(0, 200) || 'Shared image', descriptionHtml: html, descriptionText: item.text.slice(0, 300) });
      await native.consumeIncoming(item.id); router.replace({ pathname: '/editor', params: { entity, id } });
    } catch (e) { Alert.alert('Could not capture', String(e)); } finally { setBusy(false); }
  }
  return <Screen><Heading>Save to Dayflow</Heading>{items.length ? items.map(item => <Card key={item.id}><Body>{item.title || item.text.slice(0, 500) || 'Shared image'}</Body><Body muted>{item.images.length} image(s)</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{item.images.map(image => <Image key={image.uri} source={{ uri: image.uri }} accessibilityLabel="Shared image preview" style={{ width: 100, height: 100, borderRadius: 12 }} />)}</View><Button title="New task" disabled={busy} onPress={() => void save(item, 'task')} /><Button subtle title="New note" disabled={busy} onPress={() => void save(item, 'note')} /><Button subtle title="Discard" onPress={() => void native.consumeIncoming(item.id).then(() => setItems(rows => rows.filter(row => row.id !== item.id)))} /></Card>) : <Body muted>Share text, links or images from another app to capture them here.</Body>}</Screen>;
}
