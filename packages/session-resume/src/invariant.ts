/**
 * Package-owned invariant companion for `@mill413/dsh-session-resume`.
 * @module @mill413/dsh-session-resume/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@mill413/dsh-session-resume'

/** Cordis companion plugin name. */
export const name = 'session-resume-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package owns no independent event sequence or
 * mutable relation beyond the `sessionResume` projection fold and the
 * `@Remote('resume')` action, whose contracts are enforced by the projection
 * unit and its tests. The projection's turn boundary is a plain event fold
 * with no sibling writer to race.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
