import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { labelsFor } from '../src/i18n.ts';
import { defaults, readSettings } from '../src/time.ts';

test('preview settings migrate without importing unknown keys or invalid values', () => {
  for (const invalid of [null, false, [], 'old text']) assert.deepEqual(readSettings(invalid), defaults);
  const saved = { prefix: '[', suffix: 5, inheritSiblings: false, removeOnIndent: 'no', oldKey: true };
  assert.deepEqual(readSettings(saved), { ...defaults, prefix: '[', inheritSiblings: false });
});

test('settings, previews and all four command labels follow the Obsidian language', () => {
  const english = labelsFor('en'); const chinese = labelsFor('zh'); const traditional = labelsFor('zh-TW');
  assert.equal(labelsFor('en-GB'), english); assert.equal(labelsFor('ja'), english);
  assert.equal(labelsFor('zh_CN'), chinese); assert.equal(labelsFor('zh-Hans'), chinese);
  assert.equal(labelsFor('zh-Hant'), traditional);
  assert.match(english.preview('[12:34]'), /- \[12:34\] Note text$/);
  assert.match(chinese.preview('[12:34]'), /- \[12:34\] 正文$/);
  for (const key of ['toggle', 'short', 'long', 'end']) {
    assert.match(english.commands[key], /time/i); assert.match(chinese.commands[key], /时间/);
    assert.match(traditional.commands[key], /時間/);
  }
});

test('TickBullet uses its install ID, package name and GitHub repository consistently', async () => {
  const read = async filename => JSON.parse(await readFile(new URL('../' + filename, import.meta.url), 'utf8'));
  const [manifest, pkg, lock, versions] = await Promise.all(['manifest.json','package.json','package-lock.json','versions.json'].map(read));
  assert.equal(manifest.id, 'tick-bullet'); assert.equal(manifest.name, 'TickBullet');
  assert.equal(pkg.name, `obsidian-${manifest.id}`);
  assert.equal(pkg.repository, `github:pasiooooo/${pkg.name}`);
  assert.equal(lock.name, pkg.name); assert.equal(lock.packages[''].name, pkg.name);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.version, manifest.version); assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(versions[manifest.version], manifest.minAppVersion);
  assert.equal(manifest.minAppVersion, pkg.devDependencies.obsidian);
});
