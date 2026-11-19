import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('a repeated package excludes assets removed from the current build', async () => {
  const browser = new URL('../web/dist/lambda/browser/', import.meta.url);
  await mkdir(browser, { recursive: true });
  const obsolete = new URL('obsolete-packaging-regression.txt', browser);
  await writeFile(obsolete, 'This asset must not enter the next release.');
  await promisify(execFile)(process.execPath, ['tools/package-web.mjs']);
  await assert.rejects(access(obsolete), { code: 'ENOENT' });
});

test('the Lambda artifact can be packed by the SAM npm builder', async () => {
  assert.ok(process.env.npm_execpath, 'Ejecuta esta prueba mediante npm run test:package.');
  const result = await promisify(execFile)(process.execPath,
    [process.env.npm_execpath, 'pack', '--dry-run', '--json'],
    { cwd: new URL('../web/dist/lambda/', import.meta.url) });
  const [packageInfo] = JSON.parse(result.stdout);
  assert.ok(packageInfo.files.some((file) => file.path === 'index.mjs'));
  assert.ok(packageInfo.files.some((file) => file.path === 'server/server.mjs'));
  assert.ok(packageInfo.files.some((file) => file.path.startsWith('browser/')));
});
