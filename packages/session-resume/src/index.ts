/**
 * Session-resume service (`ctx.sessionResume`). It registers the
 * `sessionResume` session projection (the client button's source of truth) and
 * exposes one remote action that asks a live agent to continue the
 * crash-interrupted turn it stopped on. The action is strictly user-triggered:
 * there is no automatic continuation, and the agent is only nudged when the
 * durable log still ends on an interrupted turn.
 *
 * @module @deepseek-ai/dsh-session-resume
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import sz from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import { applySessionResumeProjection, InitialSessionResumeProjection } from './projection.ts'
import { buildResumeMessage } from './resume.ts'
import type { SessionResumeProjection, SessionResumeSuccess } from './types.ts'

/** Plugin config schema; empty — the feature is always-on when mounted. */
export interface Config {}

/** Schemastery config schema (Cordis requires one on Service plugins). */
export const Config: sz<Config> = sz.object({})

/** Wire/state schema for the `sessionResume` projection; plain JSON. */
const sessionResumeProjectionSchema: ZodType<SessionResumeProjection> = zod.object({
  interruptedTurn: zod.number().int().positive().nullable(),
})

export { applySessionResumeProjection, InitialSessionResumeProjection } from './projection.ts'
export { buildResumeMessage, resumeProducerName } from './resume.ts'
export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionResume: SessionResumeService
  }
}

/** Session-resume service (`ctx.sessionResume`). */
export class SessionResumeService extends TypertRemoteService {
  static inject = ['agents']

  static Config: sz<Config> = Config

  constructor(ctx: Context) {
    super(ctx, 'sessionResume')
    // The `sessionResume` projection unit: a last-wins fold (see the types
    // module). The unit activates only when a projection registry is composed
    // (headless assemblies stay unaffected).
    ctx.inject(['sessionProjections'], (projectionCtx) => {
      projectionCtx.sessionProjections.register<'sessionResume', SessionResumeProjection>({
        key: 'sessionResume',
        stateSchema: sessionResumeProjectionSchema,
        init: () => InitialSessionResumeProjection,
        apply: applySessionResumeProjection,
        wire: { viewSchema: sessionResumeProjectionSchema, view: state => state },
        stateVersion: 1,
      })
    })
  }

  /**
   * Ask the live agent for one session to continue the crash-interrupted turn
   * it stopped on. The agent is resolved from the wire session identity, so the
   * client never receives a live-agent handle directly.
   * @param sessionId - the wire session identity.
   * @returns the resumed turn number.
   * @throws {@link HarnessError} when the agent for the session is not live or
   *   the session has no pending interrupted turn.
   */
  @Remote('resume')
  resume(sessionId: SessionId): SessionResumeSuccess {
    const agent = this.ctx.agents.get(sessionId)
    if (agent === undefined) {
      throw new HarnessError('no live agent for the session', 'AGENT_NOT_LIVE')
    }
    const interruptedTurn = interruptedTurnOf(agent.session)
    if (interruptedTurn === null) {
      throw new HarnessError('session has no interrupted turn to resume', 'NOT_INTERRUPTED')
    }
    agent.followup(buildResumeMessage())
    return { resumedTurn: interruptedTurn }
  }
}

/** Fold the live session log to its current interrupted-turn mark. */
function interruptedTurnOf(session: Session): number | null {
  let state: SessionResumeProjection = InitialSessionResumeProjection
  for (const event of session.snapshotEvents()) {
    state = applySessionResumeProjection(state, event)
  }
  return state.interruptedTurn
}

export default SessionResumeService
