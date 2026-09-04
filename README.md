# dsh-session-resume

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that
surfaces a **Continue** button when a session is interrupted mid-turn. When the
Harness process dies mid-turn (a restart, an OOM kill, or a crash), the
resumed session sits on an interrupted turn; clicking the button asks the model to
pick up where that turn left off — no manual "continue" message. Continuation is
**strictly user-triggered**: nothing ever resumes itself.

[中文说明](README.zh.md)

## What it does

- **Detects a crash-torn turn.** There is no persisted "was interrupted" flag — the
  `sessionResume` projection derives the state from the repaired session log, so it
  only fires for a genuinely crash-interrupted turn.
- **Shows a Continue button.** A dock strip in the `conversation.input.dock` composer
  slot (the same family as the goal, todo, and queue docks), rendered only while
  `interruptedTurn != null`.
- **Continues on click.** It calls the host `@Remote('resume')` with the wire
  `sessionId`, which queues a plugin-origin `notice` message telling the model to
  continue. Once the continuation starts, the projection clears and the button
  disappears.

It never continues automatically, and it never disguises the continuation as a manual
user input.

## How it works

1. **Detection** — the `sessionResume` projection folds every committed `turn/end`:
   a `turn/end` whose `reason.kind === 'interrupted'` marks the session
   interrupted-pending and carries the interrupted turn number; the next `turn/start`
   clears the mark. The projection ships to the client through the standard
   `session/projection` frames, so the plugin owns no store of its own.
2. **Button** — the Web strip reads `useProjection('sessionResume')` and renders the
   Continue button only when `interruptedTurn != null`.
3. **Continue** — the host resolves the live agent, re-folds the session log, and, if a
   pending interrupted turn exists, calls `agent.followup(buildResumeMessage())`. The
   `"retry only if read-only or idempotent"` guidance honors the crash-repair
   `TOOL_OUTCOME_UNKNOWN` semantics rather than blindly re-running a possibly
   side-effecting tool.

### Detection scope

Only `turn/end { reason: 'interrupted' }` is treated as resumable. That marker is
produced **only** by the crash-repair path, so it covers every case where the process
died mid-turn (restart, OOM, `kill`, crash). It deliberately does **not** cover
`max-tokens` (a model output cap), `aborted` (an explicit cancel), `error`, or
`blocked` — those are either not "was cut off and wants to continue" or are
user-initiated. Extending to `max-tokens` / `aborted` is a possible follow-up.

## Install

The plugin is installed into a DSH profile with the `dsh-plugin` CLI, which anchors the
package path (or name), applies each package's `dsh.bundle` patch, and reconciles the
profile's bundle layer stack. Host and UI are two separate packages, so both must be
added to the same profile.

From a **local source checkout** — build the plugin first (see
[Development](#development)), then add each package by path from the harness checkout:

```sh
pnpm install
pnpm run build

cd <harness-checkout>
pnpm dsh plugin --profile web add <path-to-dsh-session-resume>/packages/session-resume
pnpm dsh plugin --profile web add <path-to-dsh-session-resume>/packages/ui-session-resume
```

From a **published npm package** once the packages are released, the same CLI installs
them by name:

```sh
dsh plugin --profile web add @mill413/dsh-session-resume
dsh plugin --profile web add @mill413/dsh-client-ui-session-resume
```

Either way, after changing the profile's bundle list you need to **restart the DSH web
process** (however you run it — `dsh web`, a service manager, or your own setup) so the
new bundle loads. Both `add` commands run `pnpm add` in `$DSH_HOME/profiles/web` and add
the packages to `dsh.profile.bundles`. A path install links the package by path, so
rebuilding the plugin's `lib/` and restarting picks up the changes. Do **not** hand-insert
the plugin into `$DSH_HOME/profiles/web/cordis.patch.yml` — the `cordis.patch.yml` shipped
inside the packages already composes the row, and a duplicate insert will fail the loader.

## Compatibility

Tested and built against **`@deepseek-ai/dsh` `0.1.2-alpha.5`** (the harness release
line this plugin was verified on). The host and UI packages declare their
`@deepseek-ai/*` dependencies as `"*"` peers, resolved at runtime by the host DSH web
profile's node_modules, per the plugin development convention. A later harness release
may change the session-projection or conversation-input-dock seams; check this section
after a `dsh` upgrade.

## Use it

On the next cold load after a crash, the session shows the Continue strip above the
composer. The label and button follow the UI language (`zh` / `en`); the model-facing
continuation text is pinned in `packages/session-resume/src/resume.ts`. The strip and
button never appear on a normal session, a user-cancelled turn, a `max-tokens` cutoff,
or a session with no interrupted turn.

## Configuration

The host service declares an empty `Config` (`Config: z.object({})`), so the plugin is
always-on when mounted and is not tunable from `cordis.yml`. There is no
automatic-continuation mode and no per-deployment copy override.

## Development

Build, test, and produce a publishable tarball from source:

```sh
pnpm install            # needs a sibling ../deepseek-harness checkout (workspace mirror)
pnpm run build          # host: tsc + tsdown + typert;  client: tsc + tsdown clientBundle
pnpm test               # host fold/resume-message + Web dock component tests

npm pack --dry-run -C packages/session-resume
npm pack --dry-run -C packages/ui-session-resume
```

The host projection fold and the resume-message builder are pure and unit-tested in
`packages/session-resume/tests/`; the composer-dock component is covered in
`packages/ui-session-resume/tests/resume-dock.client.spec.tsx`.

> **Note (standalone workspace):** `@deepseek-ai/dsh-typert-protocol` is not linked at
> the repo-root `node_modules` (it is a `workspace:*` dep of the host/client packages
> only). Running `vitest` from the repo root therefore resolves it only if the
> package's own `node_modules` is on the resolution path. The projection spec
> (`projection.spec.ts`) does not import the llm/typert chain and runs cleanly; the two
> specs that transitively import `@deepseek-ai/dsh-llm` (`resume-message.spec.ts`,
> `resume-dock.client.spec.tsx`) need the link to resolve.

## Known limitations

- The continuation is **strictly user-triggered**; there is deliberately no
  automatic-continuation mode. A configurable auto mode is a possible follow-up.
- Detection is scoped to a crash-torn turn only (`reason: 'interrupted'`). It does not
  offer to continue `max-tokens` or `aborted` turns, nor a session whose agent went idle
  with queued background work (e.g. an armed goal round — that scenario is owned by the
  goal subsystem's own resume flow).

## License

MIT. See the host package's [README](packages/session-resume/README.md) and
[`README.zh.md`](packages/session-resume/README.zh.md) for the full design, install,
and model-experience notes.
