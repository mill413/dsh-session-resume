# Contributing

This repository uses a trunk-based release flow.

- `master` is the only long-lived branch and must remain buildable.
- Develop changes on short-lived topic branches and merge them into `master`
  through review when collaboration requires it.
- CI runs for pull requests and pushes to `master`.
- npm publishing is triggered only by a `v*` tag whose version matches the
  package manifest; ordinary branch pushes and manual CI runs never publish.
- Do not create permanent `dev` or `release` branches unless the repository's
  maintainers first replace this documented policy and update branch
  protection and CI together.
