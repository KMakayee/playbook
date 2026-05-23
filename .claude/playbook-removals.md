# Playbook Removals

> Paths the playbook USED to manage but no longer does. When `/playbook-update` runs in a target repo, it offers (with developer approval) to remove these orphans so the repo doesn't accumulate dual-source-of-truth files (e.g. a renamed skill still registered under its old `/command` path).

## For playbook maintainers

- Add an entry whenever you rename, delete, or relocate a file that was previously in `/playbook-update`'s managed-files list.
- Every `path` MUST start with one of the allowed prefixes enforced by `.claude/skills/playbook-update/SKILL.md` (see "Step 2.5 — Validate scope"). The skill aborts the update if a forbidden path is listed — this is intentional, so a typo can't damage target repos.
- Drop entries after roughly 6 months. By then most users will have updated past the removal point and the entry is just clutter.
- `/playbook-update` reads this file from the playbook source (the temp clone), not from the target repo's local copy. The README install does propagate it as part of the wholesale `.claude/` move, but that local copy is unused by the update flow and is not refreshed by `/playbook-update`.

## Format

```
- path: <relative path from repo root>
  since: YYYY-MM-DD
  reason: <one-line note shown to the developer during the approval prompt>
```

A trailing `/` on `path` denotes a directory; no trailing `/` denotes a single file.

## Entries

- path: .claude/commands/
  since: 2026-05-22
  reason: Ported to .claude/skills/<name>/SKILL.md (PR #28 / Task 7)
