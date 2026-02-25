# Lessons Learned

> **Purpose:** Capture corrections and mistakes so they compound into better behavior over time.
> **When to update:** After any user correction, failed verification, or repeated mistake.
> **When to review:** At the start of each new session — read this file before beginning work.

---

## Entry Format

Each entry follows this structure:

```
### YYYY-MM-DD — [Short title]

**What happened:** [Factual description of the mistake or correction]
**Why it happened:** [Root cause — not "I made an error" but WHY]
**Prevention rule:** [Concrete, actionable rule to avoid this in the future]
**Severity:** low | medium | high
```

---

## Lifecycle

Lessons are not permanent. Apply these rules to keep the file focused and actionable:

**Graduation (removal):** An entry may be removed when ALL of these are true:
- It is older than 90 days
- Its severity is low or medium (never auto-graduate high-severity entries)
- The mistake has not recurred since the entry was written

**Consolidation:** When two or more entries share the same root cause or produce the same prevention rule, merge them into a single entry. Keep the most recent date and the strongest prevention rule.

**Active entry cap:** Target ~30 active entries. When the file grows past this, review for graduation and consolidation candidates. If still over cap after lifecycle review, prioritize keeping high-severity and recent entries.

**Never delete the file itself.** Even if all entries graduate, keep the file with the template structure intact.

---

## Entries

### 2025-01-15 — Modified file without reading it first

**What happened:** Proposed edits to `src/auth/middleware.ts` based on assumptions about its structure. The edits broke the existing error handling pattern.
**Why it happened:** Skipped the Read step to save time. Assumed the file followed the same pattern as adjacent files.
**Prevention rule:** Always read a file before editing it. No exceptions — even for "obvious" changes.
**Severity:** high

---

<!-- Add new entries above this line. Most recent first. -->
