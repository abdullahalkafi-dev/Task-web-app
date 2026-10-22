import { Editor } from '@tiptap/core';
import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { buildExtensions } from '@dayflow/editor';

declare global { interface Window { ReactNativeWebView: { postMessage(value: string): void }; dayflowReceive(value: unknown): void } }
const post = (value: unknown) => window.ReactNativeWebView.postMessage(JSON.stringify(value));
// Cached bytes belong to the rendered view, never the document. This avoids
// serializing large base64 images on each keystroke or marking cache loads as
// edits, and preserves identity when two uploads contain identical bytes.
const imageSources = new Map<string, string>();
const imageViews = new Set<() => void>();
const MobileImage = Image.extend({ addNodeView() { return ({ node }) => {
  const dom = document.createElement('img'); let current = node;
  dom.draggable = true;
  const render = () => { const source = imageSources.get(current.attrs.src) ?? ''; if (dom.getAttribute('src') !== source) dom.setAttribute('src', source); dom.alt = current.attrs.alt ?? 'Image'; };
  imageViews.add(render); render();
  return { dom, update(next) { if (next.type !== node.type) return false; current = next; render(); return true; }, ignoreMutation() { return true; }, destroy() { imageViews.delete(render); } };
}; } });
function changed() { post({ type: 'change', html: editor.getHTML(), text: editor.getText().slice(0, 300) }); }
const editor = new Editor({ element: document.getElementById('editor')!, extensions: buildExtensions<AnyExtension>('Write something...', { Image: MobileImage, Link, Placeholder, Underline, StarterKit }), content: '', editorProps: { attributes: { role: 'textbox', 'aria-label': 'Description' } }, onUpdate: changed });
window.dayflowReceive = value => {
  if (!value || typeof value !== 'object') return;
  const msg = value as Record<string, unknown>;
  if (msg.type === 'theme' && typeof msg.dark === 'boolean') {
    document.documentElement.style.colorScheme = msg.dark ? 'dark' : 'light';
    document.body.style.color = msg.dark ? '#F3F4F6' : '#172033';
    document.body.style.backgroundColor = msg.dark ? '#1D2533' : '#FFFFFF';
  }
  if (msg.type === 'set' && typeof msg.html === 'string') { editor.commands.setContent(msg.html, false); }
  if (msg.type === 'image' && typeof msg.original === 'string' && typeof msg.data === 'string' && msg.data.startsWith('data:image/')) {
    imageSources.set(msg.original, msg.data); imageViews.forEach(render => render());
  }
  if (msg.type === 'insertImage' && typeof msg.id === 'string') editor.chain().focus().insertContent({ type: 'image', attrs: { src: `local:${msg.id}`, 'data-local-id': msg.id } }).run();
  if (msg.type === 'command' && typeof msg.command === 'string') {
    const chain = editor.chain().focus();
    switch (msg.command) {
      case 'bold': chain.toggleBold().run(); break;
      case 'italic': chain.toggleItalic().run(); break;
      case 'underline': chain.toggleUnderline().run(); break;
      case 'h1': chain.toggleHeading({ level: 1 }).run(); break;
      case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
      case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
      case 'bullet': chain.toggleBulletList().run(); break;
      case 'ordered': chain.toggleOrderedList().run(); break;
      case 'quote': chain.toggleBlockquote().run(); break;
      case 'code': chain.toggleCodeBlock().run(); break;
      case 'strike': chain.toggleStrike().run(); break;
      case 'link': if (typeof msg.href === 'string' && /^https?:\/\//i.test(msg.href)) chain.setLink({ href: msg.href }).run(); else chain.unsetLink().run(); break;
      case 'undo': chain.undo().run(); break;
      case 'redo': chain.redo().run(); break;
    }
  }
  if (msg.type === 'flush') post({ type: 'flushed', requestId: msg.requestId, html: editor.getHTML(), text: editor.getText().slice(0, 300) });
};
document.addEventListener('click', event => { const a = (event.target as HTMLElement).closest('a'); if (a) { event.preventDefault(); post({ type: 'openLink', href: a.getAttribute('href') }); } });
post({ type: 'ready' });
