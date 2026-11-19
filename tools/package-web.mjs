import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from '../web/node_modules/esbuild/lib/main.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'web/dist/lambda');
const expected = fileURLToPath(new URL('../web/dist/lambda', import.meta.url));
if (output !== resolve(expected) || !output.startsWith(resolve(root, 'web/dist'))) {
  throw new Error('La salida de Lambda debe permanecer dentro de web/dist/lambda.');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'web/dist/cotitrama-web/browser'), resolve(output, 'browser'), { recursive: true });
await cp(resolve(root, 'web/dist/cotitrama-web/server'), resolve(output, 'server'), { recursive: true });
await writeFile(resolve(output, 'package.json'), JSON.stringify({ name: 'cotitrama-ssr', version: '0.1.0', private: true, type: 'module' }));
await build({
  stdin: {
    contents: `import serverless from 'serverless-http';\nimport { reqHandler } from './server/server.mjs';\nexport const handler = serverless(reqHandler, { provider: 'aws' });\n`,
    resolveDir: resolve(root, 'web'),
    sourcefile: 'lambda-entry.mjs',
  },
  outfile: resolve(output, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: ['./server/server.mjs'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
console.log('Lambda SSR lista en web/dist/lambda (handler index.handler).');
