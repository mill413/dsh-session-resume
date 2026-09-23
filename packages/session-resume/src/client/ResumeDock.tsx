/**
 * ResumeDock: the continue strip docked above the message composer (input dock
 * strip). A session that was torn by a restart shows a short label and a
 * "Continue" button; clicking it asks the host to nudge the model to keep
 * going from the interrupted turn. Live state arrives as the projected
 * `sessionResume` snapshot; the resume verb is the injected face. Loading
 * (undefined), not-interrupted (null), and already-continued states render
 * nothing.
 */

import { useCallback, useState } from 'react'
import { IconPlayOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResumeActionResult, ResumeDockActions } from './slots.ts'
import css from './ResumeDock.module.css'

export interface ResumeDockBarProps extends ResumeDockActions {
  /** The interrupted turn number to resume, or `null`/`undefined` for no strip. */
  interruptedTurn: number | null | undefined
}

/** Strip presentation: label + resume button, visible only for a pending interrupted turn. */
export function ResumeDockBar({ interruptedTurn, onResume, t }: ResumeDockBarProps & PropsLocale<'session-resume'>) {
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const runResume = useCallback(async () => {
    if (pending) return
    setPending(true)
    setActionError(null)
    let result: ResumeActionResult
    try {
      result = await onResume()
    } catch (error: unknown) {
      setPending(false)
      setActionError(String(error))
      return
    }
    setPending(false)
    if (!result.ok) setActionError(`${result.error.message} (${result.error.code})`)
  }, [pending, onResume])

  if (interruptedTurn === undefined || interruptedTurn === null) return null

  return (
    <div className={css.dock} data-session-resume-dock>
      <div className={css.bar}>
        <span className={css.icon} aria-hidden="true"><IconPlayOutlineRegular size={14} /></span>
        <span className={css.label}>{t('interrupted.label')}</span>
        {actionError !== null
          ? <span className={css.error} role="alert">{actionError}</span>
          : <span className={css.spacer} />}
        <button
          type="button"
          className={css.resumeBtn}
          disabled={pending}
          onClick={() => { void runResume() }}
          aria-label={t('action.resume.aria')}
        >
          {t('action.resume')}
        </button>
      </div>
    </div>
  )
}

/** Full props of the dock entry: Runtime share + injected verbs + the locale seat. */
export type ResumeDockProps = PropsRuntime<'conversation.input.dock'> & ResumeDockActions & PropsLocale<'session-resume'>

/** Dock adapter: reads the host-computed `sessionResume` projection (absent or null renders nothing). */
export function ResumeDock({ useProjection, onResume, t }: ResumeDockProps) {
  const projection = useProjection('sessionResume')
  const interruptedTurn = projection === undefined ? undefined : projection.interruptedTurn
  return <ResumeDockBar interruptedTurn={interruptedTurn} onResume={onResume} t={t} />
}
