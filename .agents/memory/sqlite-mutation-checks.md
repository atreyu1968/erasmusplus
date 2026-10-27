---
name: SQLite mutation checks
description: Verify database state after SQLite updates rather than relying on success messages.
---

For SQLite mutations, confirm the affected rows or re-read the changed record before treating an operation as successful. Bind-parameter count mistakes can leave state unchanged while the surrounding handler still renders its success message.

**Why:** A gallery publication flow showed a success message even though an update with a missing bind value had not changed the record.

**How to apply:** Add integration assertions against the resulting public page or persisted record for state-changing actions such as publishing, moving, approving, or deleting.
