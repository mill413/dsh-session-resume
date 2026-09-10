import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.base.json'] })],
  // The merged package's nearest tsconfig is the Host program, which carries no
  // JSX setting; the browser spec authors JSX, so transform it automatically.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['packages/*/tests/**/*.spec.{ts,tsx}'],
    environment: 'node',
    server: {
      deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] },
    },
  },
})
