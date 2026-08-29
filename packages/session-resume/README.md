# @deepseek-ai/dsh-session-resume

A DSH plugin that surfaces a **Continue** button when a session was interrupted
mid-turn, and only on click asks the model to pick up where the interrupted turn
left off.

When the Harness process dies mid-turn (a `systemctl restart dsh-web`, an OOM
kill, a crash), the durable session log ends on an orphaned `turn/start`. On the
next cold load the session-persistence layer repairs that torn log by closing it
with a synthetic `turn/end { reason: { kind: 'interrupted' } }`. The session is
resumed but the harness does not auto-continue it, so the user has to act.

This plugin closes that gap with a **user-triggered** continuation: the UI shows a
button while the session is sitting on an interrupted turn, and clicking it queues
a plugin-origin `notice` message telling the model to continue. Nothing ever
continues automatically.

## Packages

- `packages/session-resume` — `@deepseek-ai/dsh-session-resume` (host): registers
  the `sessionResume` session projection and the `@Remote('resume')` action.
- `packages/ui-session-resume` — `@deepseek-ai/dsh-client-ui-session-resume`
  (Web client): the composer-dock continue strip.
- `packages/typert-protocol` — the Typert Remote protocol the generator needs.

## How it works

1. **Detection** — there is no persisted "was active / was interrupted" flag; the
   plugin derives the state from the repaired log. The `sessionResume` projection
   folds every `turn/end`: a `turn/end` whose `reason.kind === 'interrupted'`
   marks the session interrupted-pending (it carries the turn number), and the
   next `turn/start` clears it. That projection ships to the client through the
   standard `session/projection` frames.
2. **Button** — the Web strip sits in the `conversation.input.dock` slot (the same
   slot as the goal bar, so it reads as part of the Todo/Goal/Queue composer-stack
   family). It reads `useProjection('sessionResume')` and renders the Continue
   button only when `interruptedTurn != null`.
3. **Continue** — the button calls the host `@Remote('resume')` with the wire
   `sessionId`. The host resolves the live agent, re-folds the session log, and if
   a pending interrupted turn exists it calls `agent.followup(buildResumeMessage())`,
   which queues a **plugin-origin `notice`** user message (not a disguised user
   input). Once the continuation starts, the projection clears and the button
   disappears.

The strict `interrupted` boundary means it only fires for a genuinely crash-torn
turn, and the "retry only if read-only or idempotent" guidance honors the
crash-repair's `TOOL_OUTCOME_UNKNOWN` semantics rather than blindly re-running a
possibly side-effecting tool.

### Detection scope

Only `turn/end { reason: 'interrupted' }` is treated as resumable. That marker is
produced **only** by the crash-repair path, so it covers every case where the
process died mid-turn (restart, OOM, `kill`, crash). It deliberately does **not**
cover `max-tokens` (a model output cap), `aborted` (an explicit cancel), `error`,
or `blocked` — those are either not "was cut off and wants to continue" or are
user-initiated. Extending to `max-tokens`/`aborted` is a possible follow-up (see
limitations).

### UI copy

The strip's label and button text live in a typed locale dictionary
(`ui-session-resume/src/client/locales.ts`) with `zh` and `en` sets, so it follows
the UI language. It is not hardcoded in the component and is not deployment-
configurable through settings (product copy is locale-owned per the client i18n
rule). The model-facing continuation text and its collapsed summary are pinned in
`session-resume/src/resume.ts`.

## Install

Install the host and UI packages into the `web` profile from the harness checkout
(the `dsh` CLI anchors relative paths, applies each package's `dsh.bundle` patch,
and reconciles the profile's bundle layer stack):

```sh
cd /home/haruto/Documents/Code/dsh/deepseek-harness
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/session-resume
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/ui-session-resume
```

Both run `pnpm add` in `$DSH_HOME/profiles/web` and add the packages to the
profile's `dsh.profile.bundles`. The profile links the packages by path, so after
rebuilding the plugin `lib/` a restart picks up the changes:

```sh
systemctl --user restart dsh-web.service   # see the workspace AGENTS.md
```

## Development

```sh
pnpm install            # workspace install; mirrors the deepseek-harness checkout
pnpm run build          # host: tsc + tsdown + typert; client: tsc + tsdown clientBundle
pnpm test               # host fold/resume-message + Web dock component tests
```

The host projection fold is pure and unit-tested in
`packages/session-resume/tests/projection.spec.ts`.

The `pnpm-workspace.yaml` mirrors the Harness's own package globs
(`vendor/*`, `packages/*/*`, `apps/*`, `website`, `python/sdk-runtime`,
`native/landlock-run`) plus a `patches` symlink to the harness, so the repo can
stand build a plugin against a sibling `../deepseek-harness` checkout. To build
against a different checkout path, update those globs, the two `overrides`
entries, and the `patches` symlink.

## Model Experience

### User, steering and injected messages

#### Model sees
The continuation is a `user`-role message whose content instructs the model to
continue the interrupted turn and to retry an interrupted tool only if it is
read-only or idempotent. It is added through `agent.followup()`, so it is both
model-visible and durable-logged.

#### Token impact
One small user message per user-triggered continuation. The interruption context
already in the log (the synthetic tool-result errors and the
`turn/end { reason: 'interrupted' }`) is retained and re-sent, so a continuation
adds its own content to the existing history.

#### KV cache impact
The continuation appends to an already-resumed prefix; it does not re-derive the
prefix material or change the system prompt. Repeated continuations keep the same
base prefix.

### Agent-scoped composition

#### Model sees
No tools, prompt sections, or listeners are added by this plugin; the model sees
only the continuation message and the already-composed system prompt.

#### Token impact
None beyond the single continuation message.

#### KV cache impact
None; the request composition is unchanged.

## Configuration

The host service declares an empty `Config` (`Config: z.object({})`), so the
plugin is always-on when mounted and is not tunable from `cordis.yml`. There is no
automatic-continuation mode and no per-deployment copy override.

## Known Limitations and Deferred Work

- The continuation is **strictly user-triggered**; there is deliberately no
  automatic-continuation mode. A configurable auto mode is a possible follow-up.
- Detection is scoped to a crash-torn turn only (`reason: 'interrupted'`). It does
  not offer to continue `max-tokens` or `aborted` turns, nor a session whose agent
  went idle with queued background work (e.g. an armed goal round — that scenario
  is owned by the goal subsystem's own resume flow).
