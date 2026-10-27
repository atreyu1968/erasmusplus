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

This setup is for the development preview, not a production deployment. Before publishing, plan durable storage for the existing SQLite database and uploads, backups, stable secrets, and production settings. Do not replace SQLite or run the Ubuntu deployment scripts as part of ordinary Replit setup.
