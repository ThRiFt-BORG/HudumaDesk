import { useState, type FormEvent } from 'react'
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { readableError } from '../lib/format'
import { supabase } from '../lib/supabase'

type AuthScreenProps = {
  configurationMissing?: boolean
}

export default function AuthScreen({ configurationMissing = false }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (configurationMissing || !supabase) {
      setError('Connect your Supabase project first by adding the two VITE_SUPABASE values to .env.local.')
      return
    }
    if (mode === 'register' && name.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }
    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setNotice('Your account is ready. Check your email for a confirmation link, then sign in here.')
          setMode('login')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
      }
    } catch (caught) {
      const message = readableError(caught)
      if (message.toLowerCase().includes('invalid login credentials')) {
        setError('That email and password did not match. Check them and try again.')
      } else if (message.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try signing in instead.')
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <header className="public-header">
        <a className="brand brand-dark" href="/" aria-label="HudumaDesk home">
          <span className="brand-mark"><Building2 size={22} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>HudumaDesk</strong><small>Murang’a County</small></span>
        </a>
        <div className="public-header-note"><span className="live-dot" /> Official public service portal</div>
      </header>

      <div className="auth-layout">
        <section className="auth-intro">
          <div className="eyebrow"><span className="eyebrow-rule" /> COUNTY SERVICES, MADE CLEAR</div>
          <h1>Good service starts with <em>being heard.</em></h1>
          <p className="auth-lede">Report a local issue, follow its progress, and keep in touch with the team working on it.</p>

          <div className="auth-steps">
            <div className="auth-step"><span className="step-number">01</span><span><strong>Tell us what’s happening</strong><small>Choose a service and share the location.</small></span></div>
            <div className="step-line" />
            <div className="auth-step"><span className="step-number">02</span><span><strong>Keep your reference</strong><small>Use it any time you check your request.</small></span></div>
            <div className="step-line" />
            <div className="auth-step"><span className="step-number">03</span><span><strong>See the next step</strong><small>Get clear status updates from the county.</small></span></div>
          </div>

          <div className="privacy-note"><ShieldCheck size={18} /><span>Your requests are private to your account.</span></div>
        </section>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-top">
            <div className="card-icon"><LockKeyhole size={19} /></div>
            <span className="secure-label">SECURE CITIZEN ACCESS</span>
          </div>
          <h2 id="auth-title">{mode === 'login' ? 'Sign in to HudumaDesk' : 'Create your account'}</h2>
          <p className="auth-card-subtitle">{mode === 'login' ? 'Pick up where you left off.' : 'Your account keeps your service requests together.'}</p>

          {configurationMissing && (
            <div className="notice notice-warning" role="status">
              <strong>Supabase still needs to be connected.</strong>
              <span>Copy .env.example to .env.local, add your Supabase project URL and anon key, then restart the dev server.</span>
            </div>
          )}
          {notice && <div className="notice notice-success" role="status"><CheckCircle2 size={18} /><span>{notice}</span></div>}
          {error && <div className="notice notice-error" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label className="field-label">Full name
                <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Wanjiku Mwangi" required minLength={2} maxLength={100} />
              </label>
            )}
            <label className="field-label">Email address
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </label>
            <label className="field-label">Password
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} />
            </label>
            <button className="button button-primary auth-submit" type="submit" disabled={busy || configurationMissing}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? 'New to HudumaDesk?' : 'Already have an account?'}{' '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice('') }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <div className="auth-card-footer"><ShieldCheck size={15} /> Your sign-in is protected by Supabase Auth.</div>
        </section>
      </div>

      <footer className="public-footer"><span>© Murang’a County Government</span><span>HudumaDesk <span className="footer-separator">/</span> Public service requests</span></footer>
    </main>
  )
}
