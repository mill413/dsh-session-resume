/**
 * Session-resume surface plugin, browser half: the ResumeDock entry in the
 * conversation.input.dock strip. Projection-mode surface — the pending
 * interrupted turn arrives through `useProjection('sessionResume')` (seeded by
 * the history tail page, updated by session/projection frames), so this plugin
 * owns no store, no refresh chain, and no event listener. The inject face
 * carries only the resume verb through the generated `sessionResume` Remote
 * API on the host side. This plugin exposes no other action: continuation is
 * strictly user-triggered from the strip.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the generated Remote API and ctx.remote merge through the Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the Conversation service and input-dock slot.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer-owned slots service.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session standard useProjection seat.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: the `sessionResume` SessionProjectionMap key merge (single source, the domain's pure outlet).
import type {} from '@deepseek-ai/dsh-session-resume/client'
// Runtime: the generated remote namespace, mounted onto ctx.remote.
import TYPERT_REMOTE from '@deepseek-ai/dsh-session-resume/remote'
import type { ResumeActionResult, ResumeDockActions } from './slots.ts'
import { ResumeDock } from './ResumeDock.tsx'
import { en, zh, type ResumeKey } from './locales.ts'

export { ResumeDock } from './ResumeDock.tsx'
export type { ResumeActionResult, ResumeDockActions } from './slots.ts'
export type { ResumeKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The continue strip's copy. */
    'session-resume': ResumeKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'session-resume'

/** Services the surface needs; the remote namespace is mounted before this inject runs. */
const SURFACE_INJECT = ['slots', 'locale', 'remote', 'remote.sessionResume', 'uiConversation']

/** Required before this plugin can mount its generated Remote contribution. */
export const inject = ['remote']

/** The one Remote call the strip needs. */
export type SessionResumeRemote = {
  resume: (sessionId: SessionId) => Promise<ResumeActionResult>
}

/**
 * Surface plugin body: mount the generated remote, then register the ResumeDock
 * dock entry with its resume verb.
 * @param ctx - client root context.
 * @returns the disposer that withdraws the surface and remote registration.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  const surface = ctx.inject(SURFACE_INJECT, applySurface)
  try {
    await surface
  } catch (error) {
    await disposeRemote()
    throw error
  }
  return async () => {
    await surface.dispose()
    await disposeRemote()
  }
}

function applySurface(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-resume: dictionaries')

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'session-resume',
    order: 5,
    locale: NS,
    inject: (sessionId): ResumeDockActions => ({
      onResume: async () => await ctx.remote.sessionResume.resume(sessionId),
    }),
  }, ResumeDock))
}
