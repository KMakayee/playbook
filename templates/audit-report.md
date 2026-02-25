# Audit Report

> **Purpose:** Output of `/playbook-audit`. Captures the current health of the playbook configuration, lessons, and task artifacts.
> **When generated:** By the `/playbook-audit` slash command. Stored in `tasks/audit-report.md`.

---

## CLAUDE.md Health

| Section | Status | Notes |
|---|---|---|
| Codebase Overview | _ok / stale / unconfigured_ | |
| Architecture | _ok / stale / unconfigured_ | |
| Conventions | _ok / stale / unconfigured_ | |
| Testing | _ok / stale / unconfigured_ | |
| Build & Run | _ok / stale / unconfigured_ | |
| Critical Paths | _ok / stale / unconfigured_ | |
| Dependencies | _ok / stale / unconfigured_ | |

**Actions taken:** [List any sections updated during this audit, or "None".]

---

## Lessons Review

**Total entries:** [N]
**Active cap:** ~30

### Graduated (removed)

| Date | Title | Reason |
|---|---|---|
| _YYYY-MM-DD_ | _[title]_ | _>90 days, low/medium severity, no recurrence_ |

### Consolidated

| Entries merged | Into | Reason |
|---|---|---|
| _[titles]_ | _[surviving entry title]_ | _Same root cause / prevention rule_ |

### Flagged for manual review

| Date | Title | Reason |
|---|---|---|
| _YYYY-MM-DD_ | _[title]_ | _High severity — requires human judgment_ |

**Actions taken:** [List changes applied, or "None — fewer than 5 entries, no action needed".]

---

## Task Artifacts

| File | Status | Action |
|---|---|---|
| `tasks/research.md` | _present / absent_ | _deleted / archived / N/A_ |
| `tasks/plan.md` | _present / absent_ | _deleted / archived / N/A_ |
| `tasks/todo.md` | _present / absent_ | _deleted / archived / N/A_ |
| `tasks/lessons.md` | _present_ | _never removed_ |

---

## Summary

- **CLAUDE.md:** [N] of 7 sections healthy, [N] stale, [N] unconfigured
- **Lessons:** [N] entries ([N] graduated, [N] consolidated, [N] flagged)
- **Artifacts:** [clean / N files cleaned up]
- **Next audit recommended:** [date, ~2-4 weeks from now]
