/**
 * Continuation-message construction for the session-resume feature.
 *
 * The continuation is delivered as two plugin-origin `notice` messages, not a
 * fake user input: a short lead names the interruption, and a detail carries
 * the tool-retry safety guidance. Both are model-visible and durable-logged;
 * the Web client renders each as a collapsed transcript row (the source carries
 * a short summary).
 *
 * @module @mill413/dsh-session-resume/resume
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/** Stable producer identity recorded on every continuation message. */
export const resumeProducerName = 'session-resume'

/** Model-facing lead: names the interruption and tells the model to continue. */
const RESUME_LEAD =
  'The previous turn was interrupted. Continue where you left off.'

/** Model-facing detail: tool-retry safety plus a guard against repeating work. */
const RESUME_DETAIL =
  'For any tool call that was interrupted, retry it only if it is read-only or idempotent; '
  + 'otherwise verify the external state before proceeding. '
  + 'Do not repeat steps that already completed.'

/** Short collapsed-transcript summary for the lead. */
const RESUME_SUMMARY = 'Interrupted — continue'

/** Short collapsed-transcript summary for the detail. */
const RESUME_DETAIL_SUMMARY = 'Resume guidance'

/**
 * Build the plugin-origin lead that asks the model to continue the interrupted
 * turn. This is the brief framing that also carries the wake.
 * @returns a frozen user-role message with a fresh identity.
 */
export function buildResumeMessage(): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: RESUME_LEAD }],
    source: { kind: 'plugin', plugin: resumeProducerName, form: 'notice', summary: RESUME_SUMMARY },
  })
}

/**
 * Build the plugin-origin detail with the tool-retry safety guidance for the
 * continuation. This is the denser instruction prepended ahead of any already
 * queued turn.
 * @returns a frozen user-role message with a fresh identity.
 */
export function buildResumeDetail(): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: RESUME_DETAIL }],
    source: { kind: 'plugin', plugin: resumeProducerName, form: 'notice', summary: RESUME_DETAIL_SUMMARY },
  })
}
