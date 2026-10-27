---
name: Replit secret lifecycle
description: Safe handling and verification of project secrets requested through Replit.
---

Treat confirmation that requested secrets were added as a signal to validate, not as proof that the stored values match the requested configuration. Validate only what is necessary without printing values.

**Why:** A secure request can leave preexisting or incorrectly entered values in place, and secrets may still exist after a user reports deleting them.

**How to apply:** Before a bootstrap action, use a non-revealing preflight for expected non-secret identifiers and required format/length checks. After cleanup, verify secret existence independently. In this workspace, removal is performed from the Project Editor's Secrets tool, not by the runtime secret callbacks.
