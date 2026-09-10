/**
 * ResumeDock's injected face. The target `conversation.input.dock` slot is
 * declared (children table) and typed by ui-conversation; this package only
 * contributes the entry, so no SlotMap merge lives here. The live interrupted
 * state is NOT part of this face — it arrives through `useProjection('sessionResume')`
 * (the framework standard kit); inject carries only the resume verb.
 */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** Settled outcome of one continuation, rendered inline by the dock. */
export type ResumeActionResult = RemoteResult<unknown>

/** Injected business face of the ResumeDock entry: the resume verb. */
export interface ResumeDockActions {
  /** Ask the host to continue the session's interrupted turn. */
  onResume: () => Promise<ResumeActionResult>
}
