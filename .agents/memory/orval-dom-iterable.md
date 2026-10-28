---
name: Generated browser headers
description: TypeScript library requirements for Orval-generated browser fetch wrappers.
---

Include `DOM.Iterable` in the TypeScript library set for the API client package.

**Why:** Orval-generated fetch code uses `Headers.entries()`. A browser target configured with only `DOM` and ES libraries fails typechecking even when the generated client is otherwise valid.

**How to apply:** After regenerating the API client or changing its TypeScript libraries, verify that `DOM.Iterable` remains enabled and rerun library typechecks.
