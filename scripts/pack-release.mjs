import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { explicitExportTargets, packageDirectories, packedResult, readJson, releaseVersion, repositoryMetadata } from './release-lib.mjs'

const root = process.cwd()
const output = resolve(root, 'dist')
const manifests = packageDirectories.map(directory => readJson(resolve(directory, 'package.json')))
const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined
const { version, distTag } = releaseVersion(manifests, tag)
mkdirSync(output, { recursive: true })

const packages = []
for (const [index, directory] of packageDirectories.entries()) {
  const manifest = manifests[index]
  if (manifest.private) throw new Error(`${manifest.name} is private`)
  const manifestPath = resolve(directory, 'package.json')
  const original = readFileSync(manifestPath, 'utf8')
  if (process.env.GITHUB_REPOSITORY) {
    Object.assign(manifest, repositoryMetadata(process.env.GITHUB_REPOSITORY, directory))
  }
  // Build-only workspace references have no place in a consumer tarball.
  delete manifest.devDependencies
  let result
  try {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    result = JSON.parse(execFileSync('npm', [
      'pack', '--json', '--ignore-scripts', '--pack-destination', output,
    ], { cwd: resolve(root, directory), encoding: 'utf8' }))
  } finally {
    writeFileSync(manifestPath, original)
  }
  const pack = packedResult(result, manifest.name)
  const files = new Set(pack.files.map(file => file.path))
  for (const file of files) {
    if (/(^|\/)node_modules(\/|$)/.test(file)) {
      throw new Error(`${manifest.name}: packed artifact contains node_modules: ${file}`)
    }
  }
  const required = [
    'package.json', 'README.md', 'LICENSE',
    manifest.main, manifest.types, manifest.dsh?.bundle?.patch,
    ...explicitExportTargets(manifest.exports),
  ].filter(Boolean).map(file => file.replace(/^\.\//, ''))
  for (const file of required) {
    if (!files.has(file)) throw new Error(`${manifest.name}: packed artifact is missing ${file}`)
  }
  packages.push({ name: manifest.name, version, filename: pack.filename, integrity: pack.integrity })
  console.log(`Packed ${manifest.name}@${version}: ${pack.filename}`)
}
writeFileSync(resolve(output, 'release.json'), `${JSON.stringify({ version, distTag, packages }, null, 2)}\n`)
