---
name: Erasmus+ media storage
description: Constraints for storing mobile message audio and attachments across Replit and Ubuntu.
---

Keep the Erasmus+ account system and SQLite-compatible `MMG_DATA_DIR` storage for Ubuntu installations unless the user approves a broader migration. Replit App Storage guidance requires Replit Auth and PostgreSQL for user uploads; do not silently switch authentication or databases just to enable managed object storage.

**Why:** The user selected retaining the existing account/database architecture and Ubuntu compatibility. Managed storage therefore needs an explicit follow-up decision rather than an implicit migration.

**How to apply:** Before connecting Replit App Storage to protected uploads, explain that it requires changing the auth/database architecture and ask for approval. Until then, retain private local storage and be clear about the persistence limitation.
