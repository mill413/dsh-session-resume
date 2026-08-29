/**
 * Pure fold of the `sessionResume` projection over the committed session log.
 *
 * The harness's crash-recovery repair closes an orphaned turn with a synthetic
 * `turn/end { reason: { kind: 'interrupted' } }`. That boundary is the durable,
 * model-visible signal that a session was torn by a restart; this fold tracks
 * it. The next `turn/start` records that a continuation was committed (or the
 * user typed a new message) and clears the pending mark.
 *
 * @module @deepseek-ai/dsh-session-resume/projection
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionResumeProjection } from './types.ts'

/** Initial projection state: no interrupted turn pending. */
export const InitialSessionResumeProjection: SessionResumeProjection =
  Object.freeze({ interruptedTurn: null })

/**
 * Fold one committed event into the projection.
 * @param state - projection covering all prior events.
 * @param event - the next committed session event.
 * @returns the next projection (same reference when the event does not change it).
 */
export function applySessionResumeProjection(
  state: SessionResumeProjection,
  event: SessionEvent,
): SessionResumeProjection {
  switch (event.type) {
    case 'turn/end':
      // The crash-repair writer is the only producer of an `interrupted`
      // turn/end. A completed/aborted/error turn leaves the mark untouched so
      // an earlier pending mark survives until its own continuation clears it.
      return event.data.reason.kind === 'interrupted'
        ? { interruptedTurn: event.data.turn }
        : state
    case 'turn/start':
      // Any new turn — user-typed or the clicked continuation — commits work
      // after the torn boundary, so the pending mark clears.
      return { interruptedTurn: null }
    default:
      return state
  }
}
