import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
// electron-builder converts this existing 512px web icon to Windows ICO resources.
await copyFile('../frontend/public/icons/icon-512.png', 'assets/icon.png');
await build({ entryPoints: ['src/main.ts', 'src/preload.ts', 'src/bubble-preload.ts'], outdir: 'dist', bundle: true, platform: 'node', format: 'cjs', external: ['electron'], sourcemap: true });
