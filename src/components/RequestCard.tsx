import { useEffect, useState } from 'react'
import { CalendarDays, Image as ImageIcon, MapPin } from 'lucide-react'
import { formatDate, statusClass } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { RequestStatus, ServiceRequest } from '../types'

const STORAGE_BUCKET = 'request-attachments'
const STATUSES: RequestStatus[] = ['In Progress', 'Resolved']

type RequestCardProps = {
  request: ServiceRequest
  displayName?: string
  admin?: boolean
  saving?: boolean
  onStatusChange?: (id: string, status: RequestStatus) => void
}

export default function RequestCard({ request, displayName, admin = false, saving = false, onStatusChange }: RequestCardProps) {
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    let active = true
    if (!supabase || !request.image_path) return
    void supabase.storage.from(STORAGE_BUCKET).createSignedUrl(request.image_path, 600).then(({ data }) => {
      if (active && data?.signedUrl) setImageUrl(data.signedUrl)
    })
    return () => { active = false }
  }, [request.image_path])

  return (
    <article className="request-card">
      <div className="request-card-top">
        <div className="request-reference"><span className="category-marker" /><span>{request.reference_number}</span></div>
        <span className={`status-pill status-${statusClass(request.status)}`}><span className="status-dot" />{request.status}</span>
      </div>
      <div className="request-card-body">
        <div className="request-title-line"><h3>{request.category}</h3><span className="request-date"><CalendarDays size={14} />{formatDate(request.created_at)}</span></div>
        <div className="request-location"><MapPin size={15} /><span>{request.location}</span></div>
        <p className="request-description">{request.description}</p>
        {displayName && <p className="request-owner">Submitted by <strong>{displayName}</strong></p>}
        {imageUrl && <a className="request-image-link" href={imageUrl} target="_blank" rel="noreferrer"><img src={imageUrl} alt={`Photo attached to ${request.reference_number}`} /><span><ImageIcon size={15} /> View attached photo</span></a>}
      </div>
      <div className="request-card-bottom">
        <div className="request-progress" aria-label={`Status: ${request.status}`}>
          <span className="progress-segment complete" /><span className={`progress-segment ${request.status !== 'Pending' ? 'complete' : ''}`} /><span className={`progress-segment ${request.status === 'Resolved' ? 'complete' : ''}`} />
          <span className="progress-caption">{request.status === 'Pending' ? 'Received by the county' : request.status === 'In Progress' ? 'Work is in progress' : 'Request resolved'}</span>
        </div>
        {admin && onStatusChange && (
          <label className="admin-status-control">Update status
            <select value={request.status} disabled={saving} onChange={(event) => onStatusChange(request.id, event.target.value as RequestStatus)}>
              <option value={request.status}>{request.status}</option>
              {STATUSES.filter((status) => status !== request.status).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        )}
      </div>
    </article>
  )
}
