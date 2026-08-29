/**
 * Tests for the continuation-message builder.
 * @module @deepseek-ai/dsh-session-resume/tests/resume-message
 */

import { describe, expect, it } from 'vitest'
import { buildResumeMessage, resumeProducerName } from '../src/resume.ts'

describe('buildResumeMessage', () => {
  it('returns a frozen user-role plugin notice with a short summary', () => {
    const message = buildResumeMessage()
    expect(message.role).toBe('user')
    expect(message.source).toMatchObject({
      kind: 'plugin',
      plugin: resumeProducerName,
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
