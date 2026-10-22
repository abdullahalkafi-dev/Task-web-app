import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { native } from '../../modules/dayflow-native';
import type { Entity } from '@dayflow/shared';
import { useDayflow } from '../lib/context';
import { EDITOR_HTML } from '../generated/editor';
import { ORIGIN } from '../lib/api';
import { Button, Input } from './ui';

export interface Content { html: string; text: string }
export interface EditorHandle { flush(): Promise<Content> }
interface Props { html: string; entity: Entity; entityId: string; onChange(content: Content): void }
export const RichEditor = forwardRef<EditorHandle, Props>(function RichEditor({ html, entity, entityId, onChange }, ref) {
  const { session, dark } = useDayflow(); const web = useRef<WebView<Record<never, never>>>(null), ready = useRef(false), current = useRef({ html, text: '' });
  const waiters = useRef(new Map<string, { resolve(value: Content): void; reject(reason: Error): void; timer: ReturnType<typeof setTimeout> }>());
  const hydrated = useRef(new Set<string>()), latest = useRef(html); latest.current = html;
  const [link, setLink] = useState(''), [linkOpen, setLinkOpen] = useState(false);
  const callback = useRef(onChange); callback.current = onChange;
  function send(message: unknown) { web.current?.injectJavaScript(`window.dayflowReceive(${JSON.stringify(message)});true;`); }
  async function hydrate(value: string) {
    if (!session) return;
    const images = [...value.matchAll(/<img\b[^>]*>/gi)];
    for (const [tag] of images) {
      const src = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
      if (!src || hydrated.current.has(src)) continue;
      const localId = /data-local-id=["']([^"']+)["']/i.exec(tag)?.[1];
      hydrated.current.add(src);
      try { const data = await native.imageData(session.user.id, localId ? `local:${localId}` : src, session.token, ORIGIN); send({ type: 'image', original: src, data }); }
      catch { hydrated.current.delete(src); }
    }
  }
  useImperativeHandle(ref, () => ({ flush: () => new Promise((resolve, reject) => {
    if (!ready.current) { reject(new Error('The editor is still loading. Please try again.')); return; }
    const requestId = `${Date.now()}-${Math.random()}`;
    const timer = setTimeout(() => { waiters.current.delete(requestId); reject(new Error('The editor could not finish saving. Your draft is retained.')); }, 5000);
    waiters.current.set(requestId, { resolve, reject, timer }); send({ type: 'flush', requestId });
  }) }));
  useEffect(() => { if (ready.current) void hydrate(html); }, [html]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready.current) send({ type: 'theme', dark }); }, [dark]);
  useEffect(() => { const pending = waiters.current; return () => { for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('Editor closed')); } pending.clear(); }; }, []);
  function receive(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
      if (msg.type === 'ready') { ready.current = true; send({ type: 'theme', dark }); send({ type: 'set', html: latest.current }); void hydrate(latest.current); }
      if ((msg.type === 'change' || msg.type === 'flushed') && typeof msg.html === 'string' && typeof msg.text === 'string' && msg.html.length <= 2000000) {
        current.current = { html: msg.html, text: msg.text.slice(0, 300) }; callback.current(current.current);
        if (msg.type === 'flushed' && typeof msg.requestId === 'string') { const waiter = waiters.current.get(msg.requestId); if (waiter) { clearTimeout(waiter.timer); waiters.current.delete(msg.requestId); waiter.resolve(current.current); } }
      }
      if (msg.type === 'openLink' && typeof msg.href === 'string' && /^https?:\/\//i.test(msg.href)) void Linking.openURL(msg.href);
    } catch { /* Reject malformed bridge messages. */ }
  }
  async function image() {
    if (!session) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) {
        const asset = result.assets[0];
        if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) throw new Error('Images must be 10 MB or smaller');
        const row = JSON.parse(await native.queueImage(session.user.id, entity, entityId, asset.uri, asset.mimeType ?? 'image/jpeg')) as { localId: string };
        send({ type: 'insertImage', id: row.localId });
      }
    } catch (error) { Alert.alert('Could not attach image', error instanceof Error ? error.message : String(error)); }
  }
  return <View style={{ gap: 8 }}><ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
    {([['bold','B'],['italic','I'],['underline','U'],['strike','Strike'],['h1','H1'],['h2','H2'],['h3','H3'],['bullet','• List'],['ordered','1. List'],['quote','Quote'],['code','Code'],['undo','Undo'],['redo','Redo']] as const).map(([command, title]) => <Button key={command} subtle title={title} onPress={() => send({ type: 'command', command })} />)}
    <Button subtle title="Link" onPress={() => setLinkOpen(value => !value)} />
    <Button subtle title="Image" onPress={() => void image()} />
  </ScrollView>{linkOpen ? <View style={{ gap: 8 }}><Input accessibilityLabel="Link URL" placeholder="https://example.com" value={link} onChangeText={setLink} autoCapitalize="none" /><Button title="Apply link" onPress={() => { send({ type: 'command', command: 'link', href: link }); setLinkOpen(false); }} /></View> : null}<WebView<Record<never, never>> ref={web} style={{ height: 340, backgroundColor: 'transparent' }} source={{ html: EDITOR_HTML, baseUrl: 'https://dayflow.invalid/' }} originWhitelist={['https://dayflow.invalid']} onMessage={receive} onShouldStartLoadWithRequest={request => request.url === 'https://dayflow.invalid/' || request.url === 'about:blank'} javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} mixedContentMode="never" setSupportMultipleWindows={false} /></View>;
});
