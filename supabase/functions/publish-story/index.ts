// Supabase Edge Function: publish-story
//
// This is the one piece of the Studio that's allowed to know your GitHub
// token. It never runs in anyone's browser — only here, on Supabase's
// servers. The frontend calls this function; this function talks to GitHub.
//
// What it does:
//   1. Confirms the caller is signed in and is an admin or editor
//   2. Loads the draft they want to publish
//   3. Fetches your live articles.json from GitHub
//   4. Checks the slug isn't already used
//   5. Inserts the new story, and the photo if one was included
//   6. Commits both to GitHub — your existing GitHub Action takes it from there
//   7. Marks the draft as published

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!
const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER')!
const GITHUB_REPO = Deno.env.get('GITHUB_REPO')!
const GITHUB_BRANCH = Deno.env.get('GITHUB_BRANCH') || 'main'
const ARTICLES_PATH = Deno.env.get('GITHUB_ARTICLES_PATH') || 'media/data/articles.json'
const IMAGES_PATH_PREFIX = Deno.env.get('GITHUB_IMAGES_PATH') || 'media/assets/images'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function githubRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  })
  return res
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Not signed in.' }, 401)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Identify the caller from their token
    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !userData?.user) return json({ error: 'Not signed in.' }, 401)

    // Confirm they're an admin or editor
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!profile || !['admin', 'editor'].includes(profile.role)) {
      return json({ error: "Your account doesn't have permission to publish." }, 403)
    }

    const { draftId, imageBase64, imageExt } = await req.json()
    if (!draftId) return json({ error: 'Missing draftId.' }, 400)

    // Load the draft
    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('*')
      .eq('id', draftId)
      .single()

    if (draftError || !draft) return json({ error: 'Draft not found.' }, 404)

    if (!draft.slug || !draft.title || !draft.excerpt || !draft.content) {
      return json({ error: 'Story is missing required fields (slug, title, excerpt, or body).' }, 400)
    }

    // Fetch current articles.json
    const currentRes = await githubRequest(`${ARTICLES_PATH}?ref=${GITHUB_BRANCH}`)
    if (!currentRes.ok) {
      const errText = await currentRes.text()
      return json({ error: `Could not read articles.json from GitHub: ${errText}` }, 502)
    }
    const currentFile = await currentRes.json()
    const currentContent = JSON.parse(atob(currentFile.content.replace(/\n/g, '')))

    // Prevent duplicate slugs
    if (currentContent.some((a: { slug: string }) => a.slug === draft.slug)) {
      return json({ error: `A story with the slug "${draft.slug}" already exists. Change the headline slightly to generate a different slug, then try again.` }, 409)
    }

    const authorName = draft.author_type === 'newsdesk' ? 'King Musah Media News Desk' : draft.author_name

    const newArticle = {
      slug: draft.slug,
      title: draft.title,
      category: draft.category,
      language: draft.language,
      author: authorName,
      date: draft.date,
      breaking: !!draft.breaking,
      featured: !!draft.featured,
      excerpt: draft.excerpt,
      image_alt: draft.image_alt || draft.title,
      content: String(draft.content).split('\n').map((p: string) => p.trim()).filter(Boolean),
      tags: draft.tags || [],
    }

    const updatedContent = [newArticle, ...currentContent]

    // If a photo was included, commit it first
    if (imageBase64 && imageExt) {
      const imagePath = `${IMAGES_PATH_PREFIX}/${draft.slug}.${imageExt}`
      const imageRes = await githubRequest(imagePath, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Add photo for: ${draft.title}`,
          content: imageBase64,
          branch: GITHUB_BRANCH,
        }),
      })
      if (!imageRes.ok) {
        const errText = await imageRes.text()
        return json({ error: `Story text is ready, but the photo upload failed: ${errText}. You can add it manually the usual way.` }, 502)
      }
    }

    // Commit the updated articles.json
    const commitRes = await githubRequest(ARTICLES_PATH, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Publish story: ${draft.title}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(updatedContent, null, 2)))),
        sha: currentFile.sha,
        branch: GITHUB_BRANCH,
      }),
    })

    if (!commitRes.ok) {
      const errText = await commitRes.text()
      return json({ error: `Could not publish to GitHub: ${errText}` }, 502)
    }

    // Mark the draft as published
    await supabase
      .from('drafts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', draftId)

    return json({ success: true, slug: draft.slug })
  } catch (err) {
    return json({ error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }, 500)
  }
})
