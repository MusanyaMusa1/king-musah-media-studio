# Phase 2 setup — connecting the Studio to your live site

This is the one part that needs manual setup — but it's all done through Supabase's
website, no terminal or installed software required.

## 1. Create a GitHub token

Go to github.com → click your profile picture (top right) → **Settings** → scroll
down to **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
→ **Generate new token**.

- Repository access: choose "Only select repositories" → pick your KMVTECHUG repo
- Under Permissions → **Contents** → set to **Read and write**
- Click Generate, then **copy the token immediately** — GitHub only shows it once,
  so paste it somewhere safe temporarily (like a Notes app) until step 3

## 2. Add the function's code in Supabase

1. In your Supabase project, click **Edge Functions** in the left sidebar
2. Click **Deploy a new function** → **Via Editor**
3. Name it exactly: `publish-story`
4. Delete whatever template code is shown, and paste in the entire contents of
   `supabase/functions/publish-story/index.ts` (included in this zip)
5. Click **Deploy function**

## 3. Add your secrets

Still in Edge Functions, look for **Secrets** (sometimes under Settings → Edge
Functions, or a "Manage secrets" link near the top of the Edge Functions page).
Add these one at a time — Name, then Value, same idea as the environment variables
you set up in Vercel:

| Name | Value |
|---|---|
| `GITHUB_TOKEN` | the token you copied in step 1 |
| `GITHUB_OWNER` | your GitHub username |
| `GITHUB_REPO` | your repo's name |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_ARTICLES_PATH` | `media/data/articles.json` |
| `GITHUB_IMAGES_PATH` | `media/assets/images` |

## That's it

From now on, clicking **Publish** in the Studio will:

1. Save your story
2. Fetch your live `articles.json`
3. Check the headline doesn't already exist as a story
4. Add your photo, if you attached one
5. Commit both to GitHub
6. Your existing GitHub Action rebuilds the site automatically — live in about a minute

## If something goes wrong

The Studio will show you the exact error message from GitHub if publishing fails —
send it to Claude along with what you were doing, and it can usually pinpoint the
fix immediately.

## Updating the function later

If Claude changes `publish-story/index.ts` in a future update, just repeat step 2 —
open the function in Supabase's editor, replace the code, click Deploy again. Your
secrets from step 3 stay saved and don't need re-entering.
