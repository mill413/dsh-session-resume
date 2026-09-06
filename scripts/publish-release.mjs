import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { packageDirectories, readJson, releaseVersion } from './release-lib.mjs'

if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF_TYPE !== 'tag') {
  throw new Error('Publishing is allowed only from a GitHub tag push')
}
const manifests = packageDirectories.map(directory => readJson(resolve(directory, 'package.json')))
const { version, distTag } = releaseVersion(manifests, process.env.GITHUB_REF_NAME)
const release = readJson('dist/release.json')
if (release.version !== version || release.distTag !== distTag || release.packages.length !== manifests.length) {
  throw new Error('Artifact release metadata does not match this tag')
}

// Validate BOTH artifacts before publishing either package.
for (const [index, pkg] of release.packages.entries()) {
  if (pkg.name !== manifests[index].name || pkg.version !== version
    || !/^[A-Za-z0-9_.-]+\.tgz$/.test(pkg.filename)) {
    throw new Error('Unexpected package in release artifacts')
  }
  const bytes = readFileSync(resolve('dist', pkg.filename))
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  if (integrity !== pkg.integrity) throw new Error(`Integrity mismatch: ${pkg.filename}`)
}

const registry = 'https://registry.npmjs.org'
for (const pkg of release.packages) {
  // npm cannot publish two packages atomically. A rerun skips an already
  // published version so it can finish a release interrupted between packages.
  const check = spawnSync('npm', ['view', `${pkg.name}@${version}`, 'version', '--json', '--registry', registry], {
    encoding: 'utf8',
  })
  if (check.error) throw check.error
  if (check.status === 0) {
    const published = JSON.parse(check.stdout)
    const publishedVersion = Array.isArray(published) && published.length === 1 ? published[0] : published
    if (publishedVersion !== version) throw new Error(`Unexpected registry response for ${pkg.name}`)
    console.log(`Already published: ${pkg.name}@${version}; skipping`)
    continue
  }
  let code
  for (const text of [check.stdout, check.stderr]) {
    try { code = JSON.parse(text)?.error?.code ?? code } catch { /* npm may also emit plain diagnostics. */ }
  }
  if (code !== 'E404') {
    throw new Error(`Cannot check ${pkg.name}: ${check.stderr || check.stdout}`)
  }
  execFileSync('npm', [
    'publish', resolve('dist', pkg.filename), '--access', 'public', '--provenance',
    '--tag', distTag, '--registry', registry, '--ignore-scripts',
  ], { stdio: 'inherit' })
}
