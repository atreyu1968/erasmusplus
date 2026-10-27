# Running Erasmus+ MMG on Replit

This is the imported Node.js 24 + SQLite application. Keep its existing stack and layout; the Ubuntu/systemd installer is not needed on Replit.

## Start

Use **Run** to start the `Start application` workflow. It runs `npm start` with `MMG_SECRET` taken from the existing `SESSION_SECRET` when no dedicated `MMG_SECRET` is set. Neither secret is stored in the repository. Keep this secret stable: it signs tokens and encrypts saved email configuration.

The development environment sets `HOST=0.0.0.0`, `PORT=5000`, `MMG_ENV=development`, `MMG_SECURE_COOKIE=1` (the Replit preview uses HTTPS), and `MMG_ENABLE_REGISTRATION=0`.

The preview opens the Spanish-language public homepage. `/acceso` is the login page and `/healthz` returns `ok`. No coordinator account is created automatically.

## Dependencies and checks

- Node.js 24 is required for the built-in `node:sqlite` module.
- Dependencies are defined in `package.json` and `package-lock.json`; restore with `npm ci` if needed.
- Run `npm run check` and `npm test` for the existing checks. Tests use temporary databases and fictional accounts.

## Storage and access

SQLite and uploaded files live under `data/` by default. This folder, dependencies, local environment files, and database files are excluded from Git. Do not delete the folder if its contents need to be retained.

To create the initial coordinator, supply `MMG_ADMIN_USERNAME`, `MMG_ADMIN_EMAIL`, and `MMG_ADMIN_PASSWORD` (at least 16 characters) securely using Replit Secrets, then run `npm run init-admin`. Remove those three bootstrap secrets afterward. Never put credentials in chat or tracked files.

Email sending is not configured. The existing coordinator settings page supports Resend configuration after the first coordinator is created; no delivery is simulated.

## Safety and deployment

Registration remains disabled. Use fictional data only, as required by the repository README. Enabling real registration requires the institution's technical and privacy approvals, approved privacy settings, and working email delivery.

This setup is for the development preview, not a production deployment. **Do not publish this app on Replit with its current storage implementation.** `src/db.mjs` and `src/feature-service.mjs` store SQLite, its WAL files, and private uploads under `MMG_DATA_DIR` (default `./data`). Replit published deployments do not preserve files across restarts or republishing, including Reserved VM deployments. Losing or separating the database and its document files would make saved records or attachments unavailable.

### Recommended data protection before production

- **Keep SQLite; do not put its database in object storage.** The compatible option with the current code is a supported, dedicated Ubuntu server/VM with a persistent local filesystem, using the existing systemd deployment and `/var/lib/erasmusplus` for the database and `documents/` together. SQLite requires normal filesystem locking and its WAL files; the database and uploads must remain on the same persistent data volume.
- **Add independent daily backups before production use.** The current updater stops the service and creates a consistent, age-encrypted archive of `/var/lib/erasmusplus` before updates, but stores it only on that server and deletes archives after about 14 days. This is useful for update rollback, not disaster recovery. Add a scheduled daily encrypted copy to institution-controlled storage on a separate system/account, with institution-approved retention and access controls.
- **Back up and restore the database and documents as one set.** Quiesce the app (or use a tested SQLite backup procedure), archive the full data directory, encrypt with the existing age recipient, and verify the backup before transferring it off-host. Keep the age identity/private key offline and separate from the backup destination. Rehearse restoring both database and documents into an isolated environment; check SQLite integrity and verify that stored file references resolve. Treat backups as personal data and apply the approved retention policy.
- **Keep the encryption/signing secret stable.** `MMG_SECRET` is used both for session/CSRF signatures and encryption of saved email settings, so changing it without a planned migration can invalidate sessions and make saved configuration unreadable. Keep the same secret through restarts and releases, protect it separately from data backups, and include a controlled recovery procedure. The development workflow currently falls back to `SESSION_SECRET`; the secret exists in this workspace, but its length and continuity across future published environments have not been verified. For a production target, set a dedicated stable `MMG_SECRET` of at least 48 characters in that target's secret manager; never put it in Git or a backup archive.
- **Require production flags.** Set `MMG_ENV=production` and `MMG_SECURE_COOKIE=1`; the app rejects production startup without a 48-character `MMG_SECRET` or secure cookies. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when configured. Use the final approved HTTPS origin and restrict the service bind address and network access to the intended proxy.
- **Keep registration closed.** Leave `MMG_ENABLE_REGISTRATION=0` and `MMG_PRIVACY_VERSION=PENDIENTE_REVISION` until the institution and its privacy lead approve the notice, required `MMG_PRIVACY_*` values, technical controls, and email delivery. Real participant registration and public publishing each require separate approval. Continue using fictional data until those gates are met.

If Replit is selected as the production host, stop before publishing and obtain approval for a storage redesign: App Storage can persist uploaded documents but does not make this local SQLite database persistent. Moving documents to App Storage would require code changes, and making structured records durable would require an explicitly approved database/storage change. Do not silently migrate away from SQLite or treat a Replit deployment filesystem as a durable disk.
