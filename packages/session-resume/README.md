# @deepseek-ai/dsh-session-resume

A DSH plugin that surfaces a **Continue** button when a session was torn by a
Harness restart, and only on click asks the model to pick up where the
interrupted turn left off.

When the Harness is restarted mid-turn (for example, because the model executed
a `systemctl restart dsh-web`), the durable session log ends on an orphaned
`turn/start`. On the next cold load the session-persistence layer repairs that
torn log by closing it with a synthetic `turn/end { reason: { kind:
'interrupted' } }`. The session is resumed but left idle — the default Harness
never continues on its own, so the user has to type a message.

This plugin closes that gap with a **user-triggered** continuation: the UI shows
a button while the session is sitting on an interrupted turn, and clicking it
queues a plugin-origin `notice` message that tells the model to continue. Nothing
ever continues automatically.

## Packages

- `packages/session-resume` — `@deepseek-ai/dsh-session-resume` (host):
  registers the `sessionResume` session projection and the
  `@Remote('resume')` action.
- `packages/ui-session-resume` — `@deepseek-ai/dsh-client-ui-session-resume`
  (Web client): the composer-dock continue strip.
- `packages/typert-protocol` — the Typert Remote protocol the generator needs.

## How it works

1. **Detection** — no persisted "was active/interrupted" flag exists; the plugin
   derives the state from the repaired log. The `sessionResume` projection folds
   every `turn/end`; a `turn/end` whose `reason.kind === 'interrupted'` marks the
   session as interrupted-pending (it carries the turn number), and the next
   `turn/start` clears it. That projection is shipped to the client through the
   standard `session/projection` frames.
2. **Button** — the Web strip sits in the `conversation.input.dock` slot (the
   same slot as the goal bar). It reads `useProjection('sessionResume')` and
   renders the Continue button only when `interruptedTurn != null`.
3. **Continue** — the button calls the host `@Remote('resume')`. The host
   re-folds the live session log; if a pending interrupted turn exists it calls
   `agent.followup(buildResumeMessage())`, which queues a **plugin-origin
   `notice`** user message (not a disguised user input) that asks the model to
   continue. Once the continuation starts, the projection clears and the button
   disappears.

The strict `interrupted` boundary means the button only appears for a genuinely
torn turn, and the "retry only if read-only or idempotent" guidance honors the
crash-repair's `TOOL_OUTCOME_UNKNOWN` semantics rather than blindly re-running a
possibly side-effecting tool.

## Install

Install the host and UI packages into the `web` profile through the plugin
command, which applies each package's own bundle patch:

```sh
dsh-session-resume/packages/session-resume:    pnpm dsh plugin --profile web add ../dsh-session-resume/packages/session-resume
dsh-session-resume/packages/ui-session-resume: pnpm dsh plugin --profile web add ../dsh-session-resume/packages/ui-session-resume
```

Run from the harness checkout (the `dsh` CLI resolves the source launch). Then
rebuild the Web bundles and restart the profile (see the workspace AGENTS.md).

## Model Experience

### User, steering and injected messages

#### Model sees
The continuation is a `user`-role message whose content instructs the model to
continue the interrupted turn and to retry an interrupted tool only if it is
read-only or idempotent. It is added through `agent.followup()`, so it is both
model-visible and durable-logged.

#### Token impact
One small user message per user-triggered continuation. The interruption context
already present in the log (the synthetic tool-result errors and the
`turn/end { reason: 'interrupted' }`) is retained and re-sent, so a continuation
adds its own content to the existing history.

#### KV cache impact
The continuation appends to an already-resumed prefix; it does not re-derive the
prefix material or change the system prompt. Repeated continuations on the same
log keep the same base prefix.

### Agent-scoped composition

#### Model sees
No tools, prompt sections, or listeners are added by this plugin; the model sees
only the continuation message and the already-composed system prompt.

#### Token impact
None beyond the single continuation message.

#### KV cache impact
None; the request composition is unchanged.

## Development

```sh
pnpm install            # workspace install; the repo mirrors the deepseek-harness
                        # module tier (checked out as ../deepseek-harness) so every
                        # `workspace:*` reference resolves locally
pnpm run build          # host: tsc + tsdown + typert; client: tsc + tsdown clientBundle
pnpm test               # host fold/resume-message + Web dock component tests
```

The host projection fold is pure and unit-tested in
`packages/session-resume/tests/projection.spec.ts`.

The `pnpm-workspace.yaml` mirrors the Harness's own package globs
(`vendor/*`, `packages/*/*`, `apps/*`, `website`, `python/sdk-runtime`,
`native/landlock-run`) so this repo can build a plugin against a sibling
`../deepseek-harness` checkout. To build against a different checkout location,
update those globs and the two `overrides` entries.

## Known Limitations and Deferred Work

- The continuation is **strictly user-triggered**: there is deliberately no
  automatic-continuation mode. A configurable auto mode is a possible follow-up.
- Detection is scoped to a torn turn only (a dangling `turn/start` repaired to
  `turn/end { interrupted }`). It does not detect a session whose agent went idle
  with queued background work (for example an armed goal round); that scenario is
  owned by the goal subsystem's own resume flow.
