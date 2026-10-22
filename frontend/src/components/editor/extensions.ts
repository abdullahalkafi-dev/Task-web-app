import type { AnyExtension, Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { buildExtensions as sharedExtensions } from '@dayflow/editor';
export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@dayflow/editor';
export function buildExtensions(placeholder: string): Extensions { return sharedExtensions<AnyExtension>(placeholder, { Image, Link, Placeholder, Underline, StarterKit }); }
