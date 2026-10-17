import {
  findWorkspaceRoot,
  WorkspaceTypertGenerator,
  writeWorkspaceArtifacts,
  type TypertFace,
} from '@deepseek-ai/dsh-typert-generator'
import { typertPlugin } from '@deepseek-ai/dsh-typert-generator/tsdown'

/**
 * alpha.3 analyzes every discovered contributor even when emitting a subset.
 * Our private protocol mirror supplies compiler symbols, not a Host service
 * to reflect: reflecting Context.typert reaches SDK augmentations outside this
 * workspace. Keep its face registration and source aliases, but exclude it
 * from contributor discovery. All business contributors still participate.
 * See UPGRADE-0.2.1-alpha.3.md for the reproduction and upstream fix.
 */
export class PluginWorkspaceGenerator extends WorkspaceTypertGenerator {
  override discover(
    faces?: readonly TypertFace[],
    includeManifest?: (manifest: Readonly<Record<string, unknown>>) => boolean,
  ) {
    return super.discover(faces, manifest =>
      manifest.name !== '@deepseek-ai/dsh-typert-protocol'
      && (includeManifest === undefined || includeManifest(manifest)))
  }
}

/** Workspace emission through public APIs, retaining upstream export validation. */
export function typertWorkspacePlugin(faces: readonly TypertFace[]) {
  const { transform } = typertPlugin({ mode: 'workspace', faces })
  const emitted = new Set<string>()
  return {
    name: 'session-resume-typert-workspace',
    transform,
    writeBundle(options: { dir?: string }) {
      if (options.dir === undefined) return
      const root = findWorkspaceRoot(options.dir)
      if (emitted.has(root)) return
      // As in the upstream plugin, the preceding tsc phase owns diagnostics.
      // Typert's merge, annotation, boundary and manifest checks remain enabled.
      const generator = new PluginWorkspaceGenerator(root, { checkDiagnostics: false })
      const artifacts = generator.generateContributors(faces)
      writeWorkspaceArtifacts(root, artifacts)
      emitted.add(root)
    },
  }
}
