/**
 * Pure types of the session-resume domain: the ONE home of the
 * `sessionResume` projection-key declaration plus the remote-result vocabulary
 * it carries, free of this package's host-side imports. Two namespace
 * projections serve it — `./types` for host consumers, `./client` (the pure
 * re-export) for client aggregates — with zero content duplication.
 *
 * @module @mill413/dsh-session-resume/types
 */

/**
 * The plugin's projection under `sessionResume`: whether the session currently
 * sits on a crash-interrupted turn awaiting user-triggered continuation.
 *
 * The harness repairs a torn log at cold load by closing the orphaned turn
 * with a synthetic `turn/end { reason: { kind: 'interrupted' } }`. Folding
 * that boundary marks the session as interrupted-pending; the next
 * `turn/start` (the continuation that the user clicks) clears it.
 */
export interface SessionResumeProjection {
  /** Turn number of the interrupted turn still awaiting continuation, or `null` when there is none. */
  readonly interruptedTurn: number | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Host fold-state for the interrupted-turn projection (JSON-persistable). */
    sessionResume: SessionResumeProjection
  }
  interface SessionProjectionMap {
    /**
     * Whether the session currently sits on a crash-interrupted turn awaiting
     * user-triggered continuation (the interrupted turn number), or `null`.
     */
    sessionResume: SessionResumeProjection
  }
}

/** Public wire alias lets Typert name the parameter without inspecting SDK sources. */
export type SessionResumeSessionId = import('@deepseek-ai/dsh-session/types').SessionId

/** Stable failure codes for one continue-triggering resume call. */
export type SessionResumeErrorCode = 'NOT_INTERRUPTED' | 'AGENT_NOT_LIVE'

/** Successful outcome of one user-triggered continuation (the resumed turn). */
export interface SessionResumeSuccess {
  /** Turn number of the interrupted turn that the model was asked to continue. */
  readonly resumedTurn: number
}
