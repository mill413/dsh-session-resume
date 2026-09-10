/** `session-resume` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'interrupted.label': '会话被中断',
  'action.resume': '继续',
  'action.resume.aria': '继续被中断的会话',
} satisfies Record<string, string>

/** The session-resume namespace key union. */
export type ResumeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'interrupted.label': 'Session interrupted',
  'action.resume': 'Continue',
  'action.resume.aria': 'Continue the interrupted session',
} satisfies Record<ResumeKey, string>
