// Supabase Edge Function: invite-user
//
// Only admins can call this successfully. It creates a new Studio account
// and sends the person an email invite to set their own password.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Not signed in.' }, 401)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !userData?.user) return json({ error: 'Not signed in.' }, 401)

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return json({ error: 'Only admins can invite new users.' }, 403)
    }

    const { email, displayName, role } = await req.json()

    if (!email || !displayName) {
      return json({ error: 'Email and name are required.' }, 400)
    }
    if (!['admin', 'editor', 'reporter'].includes(role)) {
      return json({ error: 'Role must be admin, editor, or reporter.' }, 400)
    }

    // Create the account and send them an email invite to set their password
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      { data: { display_name: displayName } }
    )

    if (inviteError) {
      return json({ error: `Could not create the account: ${inviteError.message}` }, 502)
    }

    const newUserId = inviteData.user.id

    // The database trigger auto-creates a profile with role 'editor' by
    // default — update it to whatever role the admin actually picked.
    if (role !== 'editor') {
      await supabase.from('profiles').update({ role }).eq('id', newUserId)
    }

    return json({ success: true, email })
  } catch (err) {
    return json({ error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }, 500)
  }
})
