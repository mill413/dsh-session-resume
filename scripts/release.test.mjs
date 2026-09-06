import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { explicitExportTargets, packedResult, releaseVersion, repositoryMetadata } from './release-lib.mjs'

const pair = version => [{ version }, { version }]

test('stable releases publish to latest', () => {
  assert.deepEqual(releaseVersion(pair('1.2.3'), 'v1.2.3'), { version: '1.2.3', distTag: 'latest' })
})

test('prereleases publish to next', () => {
  assert.deepEqual(releaseVersion(pair('1.2.3-rc.1'), 'v1.2.3-rc.1'), { version: '1.2.3-rc.1', distTag: 'next' })
})

test('reject mismatched versions and tags', () => {
  assert.throws(() => releaseVersion([{ version: '1.0.0' }, { version: '1.0.1' }]), /must match/)
  assert.throws(() => releaseVersion(pair('1.0.0'), 'v2.0.0'), /must match/)
})

test('reject invalid or ambiguous release versions', () => {
  for (const version of ['01.0.0', '1.0', '1.0.0+build', '1.0.0-01', 'latest', undefined]) {
    assert.throws(() => releaseVersion(pair(version)), /Unsupported/)
  }
})

test('derive package links from the actual GitHub repository', () => {
  const metadata = repositoryMetadata('example/resume', 'packages/session-resume')
  assert.equal(metadata.repository.url, 'git+https://github.com/example/resume.git')
  assert.equal(metadata.repository.directory, 'packages/session-resume')
  assert.throws(() => repositoryMetadata('https://github.com/example/resume', 'packages/session-resume'))
})

test('normalize npm 11 and npm 12 pack JSON', () => {
  const pack = { name: '@example/resume', files: [] }
  assert.equal(packedResult([pack], pack.name), pack)
  assert.equal(packedResult({ [pack.name]: pack }, pack.name), pack)
  assert.throws(() => packedResult([], pack.name), /Unexpected/)
  assert.throws(() => packedResult([pack], '@example/other'), /Unexpected/)
})

test('collect conditional exports for tarball validation', () => {
  assert.deepEqual(explicitExportTargets({ '.': { types: './lib/index.d.ts', default: './lib/index.js' }, './src/*': './src/*' }),
    ['./lib/index.d.ts', './lib/index.js'])
})

const publishScript = fileURLToPath(new URL('./publish-release.mjs', import.meta.url))

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'resume-release-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(resolve(root, 'dist'))
  mkdirSync(resolve(root, 'bin'))
  const packages = ['session-resume', 'ui-session-resume'].map((directory, index) => {
    const name = index === 0 ? '@example/resume' : '@example/ui-resume'
    mkdirSync(resolve(root, 'packages', directory), { recursive: true })
    writeFileSync(resolve(root, 'packages', directory, 'package.json'), JSON.stringify({ name, version: '1.0.0' }))
    const filename = `${directory}-1.0.0.tgz`
    const bytes = Buffer.from(`fixture ${name}`)
    writeFileSync(resolve(root, 'dist', filename), bytes)
    return { name, version: '1.0.0', filename, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` }
  })
  writeFileSync(resolve(root, 'dist/release.json'), JSON.stringify({ version: '1.0.0', distTag: 'latest', packages }))
  writeFileSync(resolve(root, 'bin/npm'), `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
if (args[0] === 'view') {
  if (process.env.MOCK_NPM_ERROR) { console.log(JSON.stringify({error:{code:process.env.MOCK_NPM_ERROR}})); process.exit(1); }
  if (args[1].startsWith('@example/resume@')) { console.log(JSON.stringify(process.env.MOCK_NPM_ARRAY ? ['1.0.0'] : '1.0.0')); process.exit(0); }
  console.log(JSON.stringify({error:{code:'E404'}})); process.exit(1);
}
`, { mode: 0o755 })
  // An extensionless executable inherits this explicit ESM package boundary.
  writeFileSync(resolve(root, 'bin/package.json'), '{"type":"module"}')
  const env = {
    ...process.env, PATH: `${resolve(root, 'bin')}${delimiter}${process.env.PATH}`,
    GITHUB_EVENT_NAME: 'push', GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v1.0.0',
  }
  delete env.MOCK_NPM_ERROR
  return { root, env }
}

test('publish rerun skips existing host and publishes missing UI from the tarball', t => {
  const { root, env } = fixture(t)
  execFileSync(process.execPath, [publishScript], { cwd: root, env })
  const calls = readFileSync(resolve(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  const publishes = calls.filter(args => args[0] === 'publish')
  assert.equal(publishes.length, 1)
  assert.equal(publishes[0][1], resolve(root, 'dist/ui-session-resume-1.0.0.tgz'))
  assert.ok(publishes[0].includes('--provenance'))
})

test('publish retry accepts npm 12 array-shaped version responses', t => {
  const { root, env } = fixture(t)
  execFileSync(process.execPath, [publishScript], { cwd: root, env: { ...env, MOCK_NPM_ARRAY: '1' } })
  const calls = readFileSync(resolve(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(calls.filter(args => args[0] === 'publish').length, 1)
})

test('registry authentication failures do not become publish attempts', t => {
  const { root, env } = fixture(t)
  const result = spawnSync(process.execPath, [publishScript], {
    cwd: root, env: { ...env, MOCK_NPM_ERROR: 'E401' }, encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Cannot check/)
  assert.doesNotMatch(readFileSync(resolve(root, 'calls.jsonl'), 'utf8'), /publish/)
})

test('reject corrupted artifacts before contacting npm', t => {
  const { root, env } = fixture(t)
  writeFileSync(resolve(root, 'dist/ui-session-resume-1.0.0.tgz'), 'corrupted')
  const result = spawnSync(process.execPath, [publishScript], { cwd: root, env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Integrity mismatch/)
})

test('manual runs cannot publish', t => {
  const { root, env } = fixture(t)
  const result = spawnSync(process.execPath, [publishScript], {
    cwd: root, env: { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' }, encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /only from a GitHub tag push/)
})

for (const fail of [false, true]) {
  test(`pack restores source manifests after ${fail ? 'npm failure' : 'success'}`, t => {
    const { root, env } = fixture(t)
    const manifestPath = resolve(root, 'packages/session-resume/package.json')
    const original = JSON.stringify({ name: '@example/resume', version: '1.0.0', devDependencies: { '@example/local': 'workspace:*' } }, null, 2)
    writeFileSync(manifestPath, original)
    writeFileSync(resolve(root, 'bin/npm'), `#!/usr/bin/env node
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
fs.writeFileSync('packed-manifest.json', JSON.stringify(manifest));
if (${fail}) process.exit(1);
console.log(JSON.stringify([{name:manifest.name, filename:'fixture.tgz', integrity:'sha512-fixture', files:['package.json','README.md','LICENSE'].map(path=>({path}))}]));
`, { mode: 0o755 })
    const packScript = fileURLToPath(new URL('./pack-release.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [packScript], {
      cwd: root, env: { ...env, GITHUB_REPOSITORY: 'example/resume' }, encoding: 'utf8',
    })
    if (fail) assert.notEqual(result.status, 0)
    else assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(manifestPath, 'utf8'), original)
    const packed = JSON.parse(readFileSync(resolve(root, 'packages/session-resume/packed-manifest.json'), 'utf8'))
    assert.equal(packed.devDependencies, undefined)
    assert.equal(packed.repository.url, 'git+https://github.com/example/resume.git')
  })
}
