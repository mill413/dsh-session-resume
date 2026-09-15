// @vitest-environment jsdom
/**
 * ResumeDockBar rendering: the strip appears only for a pending interrupted
 * turn, and its click fires the injected resume verb.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ResumeDockBar } from '../src/client/ResumeDock.tsx'
import type { ResumeActionResult } from '../src/client/slots.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof zh): string => zh[key]

const okResult: ResumeActionResult = { ok: true, value: { resumedTurn: 7 } }

describe('ResumeDockBar', () => {
  it('renders nothing for loading (undefined) and not-interrupted (null) states', () => {
    const onResume = vi.fn(() => Promise.resolve(okResult))
    const { container } = render(<ResumeDockBar interruptedTurn={undefined} onResume={onResume} t={t} />)
    expect(container.firstChild).toBeNull()
    const empty = render(<ResumeDockBar interruptedTurn={null} onResume={onResume} t={t} />)
    expect(empty.container.firstChild).toBeNull()
  })

  it('shows the continue button for a pending interrupted turn and fires the verb', () => {
    const onResume = vi.fn(() => Promise.resolve(okResult))
    const ui = render(<ResumeDockBar interruptedTurn={7} onResume={onResume} t={t} />)
    const button = ui.getByRole('button', { name: zh['action.resume.aria'] })
    expect(button).toBeDefined()
    expect(ui.container.textContent).toContain(zh['interrupted.label'])
    fireEvent.click(button)
    expect(onResume).toHaveBeenCalledOnce()
  })

  it('surfaces the remote error inline', async () => {
    const onResume = vi.fn(() => Promise.resolve<ResumeActionResult>({
      ok: false,
      error: { code: 'NOT_INTERRUPTED', message: 'no interrupted turn', details: {} },
    }))
    const ui = render(<ResumeDockBar interruptedTurn={3} onResume={onResume} t={t} />)
    fireEvent.click(ui.getByRole('button'))
    await vi.waitFor(() => {
      expect(ui.getByRole('alert').textContent).toContain('NOT_INTERRUPTED')
    })
  })
})
