import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PluginWorkspaceGenerator } from '../../../build/typert-workspace.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const requireSdk = createRequire(new URL('../package.json', import.meta.url))

// Evaluate freshly generated artifacts against the installed SDK, without
// relying on lib/ left by a previous build or Vite's protocol source alias.
async function evaluate(js: string) {
  const resolved = js.replace(/from '([^']+)'/g, (_match, specifier: string) =>
    `from '${pathToFileURL(requireSdk.resolve(specifier)).href}'`)
  const url = `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
  return import(/* @vite-ignore */ url)
}

describe('workspace Typert artifacts', () => {
  it('retains the Host reflection and strict Remote contract with external SDK augmentations', async () => {
    // The normal build runs tsc first; this test exercises the same generation
    // path without writing artifacts or depending on prebuilt output.
    const generator = new PluginWorkspaceGenerator(root, { checkDiagnostics: false })
    const artifacts = generator.generateContributors(['host'])
    expect(artifacts.map(({ package: name, face }) => [name, face])).toEqual([
      ['@mill413/dsh-session-resume', 'host'],
    ])
    const artifact = artifacts[0]!
    expect(artifact.remote).toBeDefined()
    const { TYPERT: host } = await evaluate(artifact.js)
    const { TYPERT_REMOTE: remote } = await evaluate(artifact.remote!.js)

    expect(host.model.services.map((service: { key: string }) => service.key)).toEqual(['sessionResume'])
    expect(host.model.services[0].members.map((member: { name: string }) => member.name)).toEqual(['resume'])
    expect(host.model.services[0].types).toHaveLength(2)
    expect(host.invocations).toHaveLength(1)
    expect(remote.descriptors).toHaveLength(1)
    const invocation = host.invocations[0]
    expect(invocation).toMatchObject({
      id: '@mill413/dsh-session-resume#sessionResume/resume',
      service: 'sessionResume', namespace: 'sessionResume', method: 'resume',
      invocation: { kind: 'direct' },
      parameters: [{
        name: 'sessionId', wire: 'sessionId', source: 'json',
        codec: { mode: 'strict', typeSymbol: '@mill413/dsh-session-resume/types#SessionResumeSessionId' },
      }],
      result: { mode: 'strict', typeSymbol: '@mill413/dsh-session-resume/types#SessionResumeSuccess' },
    })
    expect(remote.descriptors[0].id).toBe(invocation.id)
    for (const descriptor of [invocation, remote.descriptors[0]]) {
      expect(descriptor.parameters[0].codec.create().parse('session-1')).toBe('session-1')
      expect(() => descriptor.parameters[0].codec.create().parse(123)).toThrow()
      expect(descriptor.result.create().parse({ resumedTurn: 2 })).toEqual({ resumedTurn: 2 })
      expect(() => descriptor.result.create().parse({ resumedTurn: '2' })).toThrow()
      expect(() => descriptor.result.create().parse({})).toThrow()
    }
    const input = remote.methods['sessionResume/resume'].input({ strict: true }).create()
    expect(input.parse({ sessionId: 'session-1' })).toEqual({ sessionId: 'session-1' })
    expect(() => input.parse({ sessionId: 'session-1', extra: true })).toThrow()
    expect(artifact.remote!.dts).toContain('SessionResumeSuccess')
    expect(artifact.remote!.dts).toContain('SessionResumeSessionId')
  }, 60_000)
})
