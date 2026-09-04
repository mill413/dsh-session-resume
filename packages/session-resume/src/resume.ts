/**
 * Continuation-message construction for the session-resume feature.
 *
 * The message is a plugin-origin `notice`, not a fake user input: it instructs
 * the model to continue the interrupted turn, and the Web client renders it as
 * a collapsed transcript row (the source carries a short summary).
 *
 * @module @mill413/dsh-session-resume/resume
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/** Stable producer identity recorded on every continuation message. */
export const resumeProducerName = 'session-resume'

/** Model-facing continuation instruction, pinned verbatim. */
const RESUME_CONTENT =
  'The previous turn was interrupted. Continue where you left off. '
  + 'For any tool call that was interrupted, retry it only if it is read-only or idempotent; '
  + 'otherwise verify the external state before proceeding.'

/** Short collapsed-transcript summary for the same message. */
const RESUME_SUMMARY = 'Interrupted — continue'

/**
 * Build the plugin-origin notice that asks the model to continue the
 * interrupted turn.
 * @returns a frozen user-role message with a fresh identity.
 */
export function buildResumeMessage(): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: RESUME_CONTENT }],
    source: { kind: 'plugin', plugin: resumeProducerName, form: 'notice', summary: RESUME_SUMMARY },
  })
}
