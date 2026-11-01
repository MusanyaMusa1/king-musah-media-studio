import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const GROUPS = ['Website', 'Publishing', 'Social posting', 'AI and email', 'Automatic jobs']

const MARK = { ok: '✓', warn: '!', fail: '✗', skip: '–' }
const COLOR = { ok: 'text-wire', warn: 'text-amber', fail: 'text-red', skip: 'text-text-faint' }
const WORD = { ok: 'working', warn: 'needs attention', fail: 'not working', skip: 'not checked' }

// When the function answers with an error (for example "Only admins"), its message is inside the reply.
async function readError(error, data) {
  if (data && data.error) return data.error
  try {
    const body = await error?.context?.json?.()
    if (body && body.error) return body.error
  } catch {
    // fall through
  }
  return "Couldn't run the checks. Make sure the system-check function has been added in Supabase, then try again."
}

function Row({ check }) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className={`w-5 shrink-0 font-mono ${COLOR[check.status]}`} aria-label={WORD[check.status]}>
        {MARK[check.status]}
      </span>
      <span className="min-w-0">
        <span className="block text-sm">{check.label}</span>
        <span className={`block text-xs mt-0.5 ${check.status === 'fail' ? 'text-red' : 'text-text-faint'}`}>
          {check.detail}
        </span>
      </span>
    </li>
  )
}

export default function SystemCheck() {
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [actionResult, setActionResult] = useState(null)

  const run = useCallback(async () => {
    setRunning(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('system-check', { body: {} })
    if (invokeError || !data || !Array.isArray(data.checks)) {
      setError(await readError(invokeError, data))
    } else {
      setResult(data)
    }
    setRunning(false)
  }, [])

  useEffect(() => {
    run()
  }, [run])

  async function runAction(action, question) {
    if (!window.confirm(question)) return
    setBusyAction(action)
    setActionResult(null)
    const { data, error: invokeError } = await supabase.functions.invoke('system-check', { body: { action } })
    setBusyAction('')
    if (invokeError || !data || !Array.isArray(data.checks)) {
      setActionResult({ checks: [{ id: action, label: 'The test could not run', status: 'fail', detail: await readError(invokeError, data) }] })
      return
    }
    setActionResult(data)
  }

  const summary = result?.summary
  const present = result ? GROUPS.filter((g) => result.checks.some((c) => c.group === g)) : []

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl">System check</h1>
        <button
          onClick={run}
          disabled={running}
          className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          {running ? 'Checking…' : 'Run all checks again'}
        </button>
      </div>
      <p className="text-text-soft text-sm mb-6">
        Checks that everything the newsroom depends on is connected and working. These checks only look; they post
        nothing publicly.
      </p>

      {error && (
        <div className="mb-5 text-sm bg-red/10 border border-red/20 text-red rounded-md px-4 py-2.5">{error}</div>
      )}

      {!result && running && <p className="text-text-faint text-sm">Checking everything. This takes a few seconds…</p>}

      {summary && (
        <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-wire">{summary.ok} working</span>
          <span className={summary.warn ? 'text-amber' : 'text-text-faint'}>{summary.warn} need attention</span>
          <span className={summary.fail ? 'text-red' : 'text-text-faint'}>{summary.fail} not working</span>
          {summary.skip > 0 && <span className="text-text-faint">{summary.skip} not checked</span>}
          <span className="text-text-faint text-xs self-center">
            Checked {new Date(result.ranAt).toLocaleTimeString()}
          </span>
        </div>
      )}

      {present.map((group) => (
        <section key={group} className="mb-6">
          <h2 className="font-mono text-xs uppercase tracking-wide text-text-faint mb-2">{group}</h2>
          <ul className="border border-line rounded-lg divide-y divide-line">
            {result.checks
              .filter((c) => c.group === group)
              .map((c) => (
                <Row key={c.id} check={c} />
              ))}
          </ul>
        </section>
      ))}

      {result && (
        <section className="mt-8 border-t border-line pt-6">
          <h2 className="font-display text-xl mb-1">Send a real test</h2>
          <p className="text-sm text-text-soft mb-4">
            These two do send something, on purpose, so you can see it arrive.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                runAction('telegram-test', 'This posts one short test message to your Telegram channel. Continue?')
              }
              disabled={!!busyAction}
              className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              {busyAction === 'telegram-test' ? 'Sending…' : 'Send a test message to Telegram'}
            </button>
            <button
              onClick={() => runAction('email-test', 'This sends one test email to your own address. Continue?')}
              disabled={!!busyAction}
              className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              {busyAction === 'email-test' ? 'Sending…' : 'Send a test email to me'}
            </button>
          </div>

          {actionResult && (
            <ul className="mt-4 border border-line rounded-lg divide-y divide-line">
              {actionResult.checks.map((c) => (
                <Row key={c.id} check={c} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
