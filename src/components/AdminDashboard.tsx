import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ClipboardList, RotateCw, Search, SlidersHorizontal } from 'lucide-react'
import RequestCard from './RequestCard'
import AdminSpatialMap from './AdminSpatialMap'
import { readableError } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { RequestStatus, ServiceRequest } from '../types'

type ProfileName = { id: string; full_name: string }
type StatusFilter = 'All statuses' | RequestStatus

export default function AdminDashboard() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All statuses')
  const [savingId, setSavingId] = useState('')
  const [updateMessage, setUpdateMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function loadDashboard() {
      if (!supabase) return
      setLoading(true)
      setError('')
      try {
        const [requestResult, profileResult] = await Promise.all([
          supabase.from('requests').select('id, user_id, reference_number, category, location, latitude, longitude, description, image_path, status, created_at').order('created_at', { ascending: false }),
          supabase.from('profiles').select('id, full_name'),
        ])
        if (!active) return
        if (requestResult.error) {
          setError(readableError(requestResult.error))
        } else {
          setRequests((requestResult.data ?? []) as ServiceRequest[])
        }
        if (!profileResult.error && profileResult.data) {
          setProfileNames(Object.fromEntries((profileResult.data as ProfileName[]).map((profile) => [profile.id, profile.full_name])))
        }
      } catch (caught) {
        if (active) setError(readableError(caught))
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadDashboard()
    return () => { active = false }
  }, [reloadKey])

  const filteredRequests = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesStatus = statusFilter === 'All statuses' || request.status === statusFilter
      const matchesSearch = !query || [
        request.reference_number,
        request.category,
        request.location,
        request.description,
        profileNames[request.user_id] ?? '',
      ].some((value) => value.toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    })
  }, [profileNames, requests, searchText, statusFilter])

  async function updateStatus(id: string, status: RequestStatus) {
    if (!supabase) return
    setSavingId(id)
    setError('')
    setUpdateMessage('')
    const { data, error: updateError } = await supabase
      .from('requests')
      .update({ status })
      .eq('id', id)
      .select('id, user_id, reference_number, category, location, latitude, longitude, description, image_path, status, created_at')
      .single()
    if (updateError) {
      setError(`Status could not be updated. ${readableError(updateError)}`)
    } else {
      setRequests((current) => current.map((request) => request.id === id ? data as ServiceRequest : request))
      setUpdateMessage(`Request status updated to ${status}.`)
    }
    setSavingId('')
  }

  const resolvedCount = requests.filter((request) => request.status === 'Resolved').length
  const openCount = requests.length - resolvedCount

  return (
    <div className="dashboard-stack admin-stack">
      <section className="analytics-grid" aria-label="Request analytics">
        <article className="metric-card metric-total"><div className="metric-icon"><ClipboardList size={20} /></div><span className="metric-label">TOTAL REQUESTS</span><strong>{loading ? '—' : requests.length}</strong><small>All service categories</small><span className="metric-mark" /></article>
        <article className="metric-card metric-open"><div className="metric-icon"><AlertCircle size={20} /></div><span className="metric-label">OPEN REQUESTS</span><strong>{loading ? '—' : openCount}</strong><small>Pending or in progress</small><span className="metric-mark" /></article>
        <article className="metric-card metric-resolved"><div className="metric-icon"><CheckCircle2 size={20} /></div><span className="metric-label">RESOLVED</span><strong>{loading ? '—' : resolvedCount}</strong><small>Marked as resolved</small><span className="metric-mark" /></article>
      </section>

      <section className="admin-requests-section">
        <div className="section-heading admin-list-heading"><div><span className="section-kicker">SERVICE DESK</span><h2>All requests <span className="count-badge">{loading ? '…' : filteredRequests.length}</span></h2></div><span className="admin-access-label"><span className="live-dot" /> Live request queue</span></div>
        <div className="filter-bar">
          <label className="search-field"><Search size={17} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search reference, location or details" aria-label="Search requests" /></label>
          <label className="status-filter"><SlidersHorizontal size={16} /><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option>All statuses</option><option>Pending</option><option>In Progress</option><option>Resolved</option></select></label>
        </div>
        <AdminSpatialMap requests={filteredRequests} />
        {error && <div className="notice notice-error" role="alert"><span>{error}</span><button className="button button-quiet retry-button" onClick={() => setReloadKey((key) => key + 1)}>Reload queue</button></div>}
        {updateMessage && <div className="notice notice-success" role="status"><CheckCircle2 size={17} /><span>{updateMessage}</span></div>}
        {loading ? (
          <div className="loading-panel"><span className="loading-mark"><RotateCw size={20} className="spin" /></span><p>Loading the request queue…</p></div>
        ) : error && requests.length === 0 ? (
          <div className="empty-state compact-empty"><div className="empty-icon"><AlertCircle size={23} /></div><h3>The request queue could not be loaded</h3><p>Check your connection and administrator access, then reload the queue.</p></div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state compact-empty"><div className="empty-icon"><Search size={23} /></div><h3>{requests.length ? 'No matching requests' : 'The queue is quiet'}</h3><p>{requests.length ? 'Try another search term or status filter.' : 'New citizen requests will appear here when submitted.'}</p></div>
        ) : (
          <div className="request-list">{filteredRequests.map((request) => <RequestCard key={request.id} request={request} displayName={profileNames[request.user_id] || 'Citizen'} admin saving={savingId === request.id} onStatusChange={updateStatus} />)}</div>
        )}
      </section>
    </div>
  )
}
