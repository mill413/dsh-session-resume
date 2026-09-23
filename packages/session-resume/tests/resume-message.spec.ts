/**
 * Tests for the continuation-message builder.
 * @module @mill413/dsh-session-resume/tests/resume-message
 */

import { describe, expect, it } from 'vitest'
import { buildResumeMessage, resumeProducerName } from '../src/resume.ts'

describe('buildResumeMessage', () => {
  it('returns a frozen user-role producer notice with a short summary', () => {
    const message = buildResumeMessage()
    expect(message.role).toBe('user')
    // Session format V4 removed the shared `plugin` source kind: each producer
    // declares its own kind in its own module.
    expect(message.source).toMatchObject({
      kind: resumeProducerName,
      form: 'notice',
    })
    expect(typeof message.source.summary).toBe('string')
    expect(message.source.summary.length).toBeLessThanOrEqual(120)
    expect(message.content).toHaveLength(1)
    expect(message.content[0]).toMatchObject({ type: 'text' })
  })

  it('produces a fresh identity per call', () => {
    expect(buildResumeMessage().id).not.toBe(buildResumeMessage().id)
  })
})
