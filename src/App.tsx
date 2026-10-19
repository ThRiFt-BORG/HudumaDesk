import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import AdminDashboard from './components/AdminDashboard'
import AuthScreen from './components/AuthScreen'
import CitizenRequests from './components/CitizenRequests'
import DashboardShell from './components/DashboardShell'
import RequestForm from './components/RequestForm'
import { readableError } from './lib/format'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { DashboardPage, Profile } from './types'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [page, setPage] = useState<DashboardPage>('requests')
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState('')

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single()

    if (error) {
      setProfile(null)
      setProfileError('Your account profile could not be loaded. Confirm that the Supabase schema is installed, then sign in again.')
      return
    }

    setProfile(data as Profile)
    setProfileError('')
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setProfileError('')
        setPage('requests')
        setLoading(false)
      } else {
        // Defer the profile query so it runs outside the auth callback.
        window.setTimeout(() => {
          if (active) void loadProfile(nextSession.user.id)
        }, 0)
      }
    })

    void supabase.auth.getSession().then(async ({ data: sessionData, error }) => {
      if (!active) return
      if (error) setProfileError(readableError(error))
      setSession(sessionData.session)
      if (sessionData.session) await loadProfile(sessionData.session.user.id)
      if (active) setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setProfileError(readableError(error))
  }

  if (!isSupabaseConfigured) return <AuthScreen configurationMissing />

  if (loading) {
    return (
      <main className="loading-screen" aria-live="polite">
        <div className="loading-mark"><LoaderCircle size={22} className="spin" /></div>
        <p>Opening your service desk…</p>
      </main>
    )
  }

  if (!session) return <AuthScreen />

  if (!profile) {
    return (
      <main className="loading-screen">
        <div className="setup-error-card">
          <AlertCircle size={26} />
          <h1>We couldn’t open your profile</h1>
          <p>{profileError || 'Your profile may still be setting up. Please try again.'}</p>
          <button className="button button-primary" onClick={() => void loadProfile(session.user.id)}>Try again</button>
          <button className="button button-quiet" onClick={() => void signOut()}>Sign out</button>
        </div>
      </main>
    )
  }

  const activePage: DashboardPage = profile.role === 'admin'
    ? page === 'new-request' ? 'new-request' : 'admin'
    : page === 'new-request' ? 'new-request' : 'requests'
  const title = activePage === 'new-request'
    ? 'Submit a request'
    : activePage === 'admin'
      ? 'Service desk overview'
      : 'My service requests'
  const subtitle = activePage === 'new-request'
    ? 'Tell us what needs attention and we’ll route it to the right county team.'
    : activePage === 'admin'
      ? 'Review incoming reports and keep residents informed.'
      : 'Follow every request from submission through resolution.'

  return (
    <DashboardShell
      profile={profile}
      email={session.user.email ?? ''}
      page={activePage}
      title={title}
      subtitle={subtitle}
      onNavigate={setPage}
      onSignOut={() => void signOut()}
    >
      {activePage === 'new-request' ? (
        <RequestForm userId={session.user.id} onSubmitted={() => setPage(profile.role === 'admin' ? 'admin' : 'requests')} />
      ) : activePage === 'admin' && profile.role === 'admin' ? (
        <AdminDashboard />
      ) : (
        <CitizenRequests userId={session.user.id} onNewRequest={() => setPage('new-request')} />
      )}
    </DashboardShell>
  )
}
