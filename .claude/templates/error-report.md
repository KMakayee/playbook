# Error & Learnings Log

> **Purpose:** Centralized log for errors and operational learnings. Persists across sessions, tracked in git.
> **Usage:** Append an error entry when a command fails. Append a learning when something surprising or reusable is discovered.

---

## Error Entry Template

```
### [YYYY-MM-DD HH:MM] — [Command Name]

- **PR:** #[number] ([branch] → [base])
- **Error:** [error type / message]
- **What happened:** [brief description]
- **Resolution:** [what was done]
```

---

## Learning Entry Template

```
### [YYYY-MM-DD HH:MM] — [Skill/Context]

- **Type:** [pattern | pitfall | preference | architecture]
- **What:** [one-line description of the learning]
- **Why it matters:** [what goes wrong without this knowledge]
- **Confidence:** [high = user-stated or verified | medium = observed | low = inferred]
```

---

## Reflection Prompt

> Use this checklist at the end of `/commit` and `/push-pr` to decide if anything is worth logging:
> - Did any command fail unexpectedly?
> - Did you take a wrong approach before finding the right one?
> - Did you discover a project-specific quirk?
> - Did something take longer because of missing context?
>
> If yes to any: append a learning entry above. Only log things that would save 5+ minutes in a future session.
