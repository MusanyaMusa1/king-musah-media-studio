# Stage 2 working-copy changes

Date: 12 November 2026

## Included
- Added the three staged database migrations under `supabase/migrations/`.
- Updated Settings with admin-only Auto Publish / Auto Delete controls, review and retention windows, and destination defaults.
- Replaced the automatic-draft detection heuristic in Drafts with explicit `is_automated` and `human_modified_at` metadata, plus exclusions for returned, scheduled and published drafts.

## Not yet implemented in this working copy
- Server-side publication queue worker and scheduling/cancellation Edge Function.
- Feed source-age enforcement and RSS publisher-image extraction / image-rights validation.
- Per-destination delivery integration in `publish-story` and `share-to-buffer`.
- System Check worker telemetry and countdown/status components.
- Website image-credit rendering and public editorial-standards update.

## Verification
- SQL archive integrity checked successfully.
- `npm ci --ignore-scripts --no-audit --no-fund` timed out in this environment; dependencies were not installed, so Vite build and lint were not run.
- No Supabase database changes, function deployments, Cron changes, or production settings changes were made.
