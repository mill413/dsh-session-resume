import { describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionResumeSessionId } from '../src/types.ts'
import { SessionResumeService } from '../src/index.ts'

const sessionId = 'test-session' as SessionResumeSessionId
const interrupted: SessionEvent = {
  type: 'turn/end', seq: 2, time: 1,
  data: { turn: 1, reason: { kind: 'interrupted' } },
}

function fixture(events: SessionEvent[], live = true) {
  const queued = { existing: true }
  const queue: unknown[] = [queued]
  const prepend = vi.fn((_channel: string, message: unknown) => queue.unshift(message))
  const steer = vi.fn()
  const get = vi.fn(() => live ? {
    session: { snapshotEvents: () => events }, inbox: { prepend }, steer,
  } : undefined)
  const service = { ctx: { agents: { get } } } as unknown as SessionResumeService
  return { resume: () => SessionResumeService.prototype.resume.call(service, sessionId), get, prepend, steer, queue, queued }
}

describe('resume action', () => {
  it('adds producer guidance ahead of queued input and wakes the requested agent', () => {
    const f = fixture([interrupted])
    expect(f.resume()).toEqual({ resumedTurn: 1 })
    expect(f.get).toHaveBeenCalledWith(sessionId)
    expect(f.prepend).toHaveBeenCalledWith('next-turn', expect.objectContaining({
      source: expect.objectContaining({ kind: 'session-resume', form: 'notice' }),
    }))
    expect(f.queue[1]).toBe(f.queued)
    expect(f.steer).toHaveBeenCalledOnce()
    expect(f.steer).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ kind: 'session-resume', form: 'notice' }),
    }))
    expect(f.prepend.mock.invocationCallOrder[0]).toBeLessThan(f.steer.mock.invocationCallOrder[0]!)
  })

  it('rejects an unloaded session without enqueuing messages', () => {
    const f = fixture([interrupted], false)
    expect(f.resume).toThrow('no live agent')
    expect(f.prepend).not.toHaveBeenCalled()
    expect(f.steer).not.toHaveBeenCalled()
  })

  it('rechecks the log and rejects a stale click after a new turn starts', () => {
    const f = fixture([interrupted, { type: 'turn/start', seq: 3, time: 2, data: { turn: 2 } }])
    expect(f.resume).toThrow('no interrupted turn')
    expect(f.queue).toEqual([f.queued])
    expect(f.steer).not.toHaveBeenCalled()
  })
})
