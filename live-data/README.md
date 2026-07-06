# live-data

This folder holds **your real, ongoing health data** (JSON exports from the app).

**It is intentionally kept OFF git.** Everything in this folder is gitignored except
this README — the data never leaves your device via the repo. This matches the app's
core principle: data stays on-device; JSON export/import is the backup path (see
`docs/Operation_Health_Technical_Design.md` §10).

## Backing it up
Since git is deliberately *not* your backup here, keep this folder safe another way:
- Let it live in a synced private drive (OneDrive/Dropbox/etc.), **or**
- Periodically copy `operation-health-*.json` somewhere private off-machine.

If you ever *do* want this in version control, that's a deliberate choice to make
explicitly — it would push personal health data into the repo's history permanently.
