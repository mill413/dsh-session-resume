import { typertPlugin } from '@deepseek-ai/dsh-typert-generator/tsdown'
import { clientBundle } from '../../build/client-bundle.ts'

// The host phase emits lib/index.js plus the generated Typert faces; the client
// phase consumes the emitted lib/typert.remote-client.js as a package subpath,
// so it must run after the host phase.
export default clientBundle(
  '@mill413/dsh-session-resume',
  ['lib/types/index.js'],
  {
    hostPhase: true,
    lib: { plugins: [typertPlugin({ mode: 'workspace', faces: ['host'] })] },
  },
)
