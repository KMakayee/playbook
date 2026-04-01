# Error Log

> **Purpose:** Centralized log for command errors. Persists across sessions, tracked in git.
> **Usage:** Append a new entry when a command encounters an unrecoverable error.

---

## Entry Template

```
### [YYYY-MM-DD HH:MM] — [Command Name]

- **PR:** #[number] ([branch] → [base])
- **Error:** [error type / message]
- **What happened:** [brief description]
- **Resolution:** [what was done — e.g., "closed and recreated PR", "reported to developer"]
```
