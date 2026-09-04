import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const harnessPath = (path: string): string =>
  fileURLToPath(new URL(`../deepseek-harness/${path}`, import.meta.url))

export default defineConfig({
  plugins: [tsconfigPaths({
    projects: ['./tsconfig.base.json', '../deepseek-harness/tsconfig.base.json'],
  })],
  resolve: {
    alias: {
      '@deepseek-ai/cordis': harnessPath('vendor/cordis/src/index.ts'),
      '@deepseek-ai/dsh-typert-protocol': fileURLToPath(
        new URL('./packages/typert-protocol/src', import.meta.url),
      ),
      '@deepseek-ai/dsh-client-ui-slots': harnessPath('packages/client/ui-slots/src/index.ts'),
      '@deepseek-ai/dsh-client-locale/client': harnessPath('packages/client/locale/src/client/index.ts'),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.spec.{ts,tsx}'],
    environment: 'node',
  },
})
