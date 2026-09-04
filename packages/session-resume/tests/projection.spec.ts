/**
 * Fold tests for the `sessionResume` projection.
 * @module @mill413/dsh-session-resume/tests/projection
 */

import { describe, expect, it } from 'vitest'
import type { SessionEvent, TurnEndReason } from '@deepseek-ai/dsh-session'
import {
  applySessionResumeProjection,
  InitialSessionResumeProjection,
} from '../src/projection.ts'

function turnStart(turn: number): SessionEvent {
  return { type: 'turn/start', seq: turn, time: 1, data: { turn } }
}

function turnEnd(turn: number, reason: TurnEndReason): SessionEvent {
  return { type: 'turn/end', seq: turn + 100, time: 1, data: { turn, reason } }
}

describe('applySessionResumeProjection', () => {
  it('starts with no interrupted turn pending', () => {
    expect(InitialSessionResumeProjection).toEqual({ interruptedTurn: null })
  })

  it('marks an interrupted turn/end, and clears it on the next turn/start', () => {
    let state = InitialSessionResumeProjection
    state = applySessionResumeProjection(state, turnStart(1))
    expect(state).toEqual({ interruptedTurn: null })
    state = applySessionResumeProjection(state, turnEnd(1, { kind: 'interrupted' }))
    expect(state).toEqual({ interruptedTurn: 1 })
    state = applySessionResumeProjection(state, turnStart(2))
    expect(state).toEqual({ interruptedTurn: null })
  })

  it('ignores a normal turn/end so an earlier pending mark survives until its turn/start', () => {
    let state = InitialSessionResumeProjection
    state = applySessionResumeProjection(state, turnStart(1))
    state = applySessionResumeProjection(state, turnEnd(1, { kind: 'interrupted' }))
    // A non-interrupted boundary with no intervening turn/start leaves the mark alone.
    state = applySessionResumeProjection(state, turnEnd(1, { kind: 'completed' }))
    expect(state).toEqual({ interruptedTurn: 1 })
  })

  it('re-marks a later interrupted turn after a normal gap', () => {
    let state = InitialSessionResumeProjection
    state = applySessionResumeProjection(state, turnStart(1))
    state = applySessionResumeProjection(state, turnEnd(1, { kind: 'interrupted' }))
    state = applySessionResumeProjection(state, turnStart(2))
    state = applySessionResumeProjection(state, turnEnd(2, { kind: 'completed' }))
    state = applySessionResumeProjection(state, turnStart(3))
    state = applySessionResumeProjection(state, turnEnd(3, { kind: 'interrupted' }))
    expect(state).toEqual({ interruptedTurn: 3 })
  })

  it('returns the same reference for unrelated events', () => {
    const state = InitialSessionResumeProjection
    const unrelated = { type: 'user/message', seq: 1, time: 1, data: {} } as unknown as SessionEvent
    expect(applySessionResumeProjection(state, unrelated)).toBe(state)
  })
})
