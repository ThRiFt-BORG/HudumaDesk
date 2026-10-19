import { useEffect, useState } from 'react'
import { ArrowRight, ClipboardList, RotateCw } from 'lucide-react'
import RequestCard from './RequestCard'
import { readableError } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { ServiceRequest } from '../types'

export default function CitizenRequests({ userId, onNewRequest }: { userId: string; onNewRequest: () => void }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function loadRequests(isRefresh = false) {
    if (!supabase) return
    setError('')
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const { data, error: queryError } = await supabase
      .from('requests')
      .select('id, user_id, reference_number, category, location, latitude, longitude, description, image_path, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (queryError) setError(readableError(queryError))
    else setRequests((data ?? []) as ServiceRequest[])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { void loadRequests() }, [userId])

  const openCount = requests.filter((request) => request.status !== 'Resolved').length
  const resolvedCount = requests.length - openCount

  return (
    <div className="dashboard-stack">
      <section className="citizen-summary">
        <div className="summary-heading"><div><span className="summary-kicker">YOUR ACTIVITY</span><h2>A clear view of every request.</h2></div><button className="button button-outline" onClick={onNewRequest}>New request <ArrowRight size={16} /></button></div>
        <div className="summary-counts"><div><strong>{requests.length}</strong><span>Submitted</span></div><div><strong>{openCount}</strong><span>Open</span></div><div><strong>{resolvedCount}</strong><span>Resolved</span></div></div>
        <div className="summary-accent" aria-hidden="true" />
      </section>

      <section className="requests-section">
        <div className="section-heading"><div><span className="section-kicker">REQUEST HISTORY</span><h2>Recent requests <span className="count-badge">{requests.length}</span></h2></div><button className="icon-button refresh-button" onClick={() => void loadRequests(true)} disabled={loading || refreshing} aria-label="Refresh requests" title="Refresh"><RotateCw size={16} className={refreshing ? 'spin' : ''} /></button></div>
        {loading ? (
          <div className="loading-panel"><span className="loading-mark"><RotateCw size={20} className="spin" /></span><p>Loading your requests…</p></div>
        ) : error && requests.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><ClipboardList size={25} /></div><h3>Requests could not be loaded</h3><p>{error}</p><button className="button button-outline" onClick={() => void loadRequests()}>Try again <RotateCw size={15} /></button></div>
        ) : requests.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><ClipboardList size={25} /></div><h3>No requests just yet</h3><p>When you report a county service issue, it will appear here with a reference number you can follow.</p><button className="button button-primary" onClick={onNewRequest}>Submit your first request <ArrowRight size={16} /></button></div>
        ) : (
          <>{error && <div className="notice notice-error" role="alert">{error}</div>}<div className="request-list">{requests.map((request) => <RequestCard key={request.id} request={request} />)}</div></>
        )}
      </section>
    </div>
  )
}
