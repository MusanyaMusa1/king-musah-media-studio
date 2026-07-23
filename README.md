# King Musah Media Studio — Phase 1

Authentication, roles, drafts, the Publish form, validation, and preview — the foundation
everything else in the plan builds on. This is a separate app from your public website;
it doesn't touch `generate_site.py`, GitHub Pages, or anything already live.

## What's built in this phase

- Sign in / sign out (Supabase Auth)
- Three roles: `admin`, `editor`, `reporter` — nav items show/hide based on role
- Publish Story form: headline, category, language, author (named journalist or "News
  Desk"), breaking/featured toggles, excerpt, story body, tags
- Save as Draft / Submit for Review / Publish (status stored in Supabase — this does
  **not** yet commit to GitHub; that's Phase 2)
- Drafts list with status filters
- Live preview modal styled like the real site
- Basic validation before submit/publish
- Read-only Users list (creating new users needs Phase 2 — see note below)

## One-time setup

### 1. Create a Supabase project (or use your existing one)

If you don't already have a project for this, create one at supabase.com — free tier
is plenty for now.

### 2. Run the database schema

Open your Supabase project → **SQL Editor** → **New query**, paste the entire contents
of `supabase-schema.sql` (included in this folder), and run it. This creates:

- `profiles` — one row per user, with their role
- `drafts` — every story in progress
- A trigger that automatically creates a `profiles` row whenever someone signs up

### 3. Create your first user (yourself, as Administrator)

In Supabase: **Authentication → Users → Add user** (email + password, or send an invite).
Once created, go to **Table Editor → profiles**, find your row, and manually change
`role` from `editor` to `admin`. This is the one manual step needed to bootstrap your
first admin — every account after this can be managed from within the Studio once
Phase 2 adds user management.

### 4. Connect your credentials

In your Supabase project: **Settings → API**. Copy the **Project URL** and the
**anon public key** (NOT the `service_role` key — that one must never be used here).

Copy `.env.example` to a new file named `.env`, and paste in your real values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

### 5. Install and run

```
npm install
npm run dev
```

Open the local address it prints (usually `http://localhost:5173`), sign in with the
account you created in step 3, and you're in.

## Deploying it somewhere real

This is a normal Vite + React app — it can be deployed for free on Vercel or Netlify.
Point either at this folder, add the same two environment variables in their dashboard
settings, and it'll build and host automatically. This is separate from your GitHub
Pages news site — the Studio can live at its own address (e.g. `studio.kingmusahmedia.com`
if you add that as a custom domain later).

## Important: publishing doesn't go live yet

Clicking "Publish" right now marks the story as `published` inside Supabase — it does
**not** yet commit to `articles.json` or trigger your site's GitHub Action. That
GitHub integration is Phase 2, and needs its own secure piece (a Supabase Edge Function
holding a GitHub token, never exposed in the browser) before "Publish" actually pushes
a story live on the real site.

## What's next (Phase 2)

- Wire the Publish button to actually write into `media/data/articles.json` and commit
- Image upload (into Supabase Storage first, then synced into `media/assets/images/`)
- The Stories page: browse, search, and edit anything already live
- Real user creation/invites from inside the Studio
