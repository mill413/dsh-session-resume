import { readFileSync } from 'node:fs'

export const packageDirectories = [
  'packages/session-resume',
]

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function releaseVersion(manifests, tag) {
  const versions = new Set(manifests.map(pkg => pkg.version))
  if (versions.size !== 1) throw new Error('All package versions must match')
  const [version] = versions
  // Releases use x.y.z or x.y.z-prerelease; build metadata is deliberately excluded.
  const number = '(?:0|[1-9][0-9]*)'
  const identifier = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
  const semver = new RegExp(`^${number}\\.${number}\\.${number}(?:-${identifier}(?:\\.${identifier})*)?$`)
  if (typeof version !== 'string' || !semver.test(version)) {
    throw new Error(`Unsupported release version: ${version}`)
  }
  if (tag !== undefined && tag !== `v${version}`) {
    throw new Error(`Tag ${tag} must match the package version: v${version}`)
  }
  return { version, distTag: version.includes('-') ? 'next' : 'latest' }
}

export function repositoryMetadata(repository, directory) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY must be owner/repository')
  }
  const url = `https://github.com/${repository}`
  return {
    repository: { type: 'git', url: `git+${url}.git`, directory },
    homepage: `${url}#readme`,
    bugs: { url: `${url}/issues` },
  }
}

export function packedResult(result, name) {
  // npm 11 returns an array; npm 12 returns an object keyed by package name.
  const packs = Array.isArray(result) ? result : Object.values(result ?? {})
  if (packs.length !== 1 || packs[0]?.name !== name || !Array.isArray(packs[0]?.files)) {
    throw new Error(`Unexpected npm pack response for ${name}`)
  }
  return packs[0]
}

export function explicitExportTargets(value) {
  if (typeof value === 'string') return value.includes('*') ? [] : [value]
  if (value && typeof value === 'object') return Object.values(value).flatMap(explicitExportTargets)
  return []
}
