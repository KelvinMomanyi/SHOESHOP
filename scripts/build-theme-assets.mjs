import { build } from 'esbuild';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const assets = fileURLToPath(new URL('../assets/', import.meta.url));
const files = (await readdir(assets)).filter((file) => /\.(js|css)$/.test(file)
  && !/\.min\.(js|css)$/.test(file) && file !== 'motion-runtime.js');

for (const file of files) {
  const entry = path.join(assets, file);
  const output = path.join(assets, file.replace(/\.(js|css)$/, '.min.$1'));
  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    legalComments: 'none',
    logLevel: 'silent'
  });
  const sourceSize = (await stat(entry)).size;
  const outputSize = (await stat(output)).size;
  console.log(`${file}: ${sourceSize} bytes -> ${outputSize} bytes`);
}
