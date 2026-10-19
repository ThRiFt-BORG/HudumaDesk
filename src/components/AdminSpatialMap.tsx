import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import type { RequestStatus, ServiceRequest } from '../types'
import { MURANGA_MAP_CENTER, MurangaCountyBoundary, useMurangaBoundary } from './MurangaCountyBoundary'

const STATUS_COLORS: Record<RequestStatus, string> = {
  Pending: '#c46a27',
  'In Progress': '#3576a8',
  Resolved: '#368267',
}

const STATUS_LABELS: RequestStatus[] = ['Pending', 'In Progress', 'Resolved']

type AdminSpatialMapProps = {
  requests: ServiceRequest[]
}

export default function AdminSpatialMap({ requests }: AdminSpatialMapProps) {
  const { boundary, boundaryError } = useMurangaBoundary()
  const pinnedRequests = requests.flatMap((request) => {
    const latitude = request.latitude
    const longitude = request.longitude
    if (
      typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) return []
    return [{ request, position: [latitude, longitude] as [number, number] }]
  })
  const unpinnedCount = requests.length - pinnedRequests.length

  return (
    <section className="spatial-map-section" aria-labelledby="spatial-map-title">
      <div className="spatial-map-heading">
        <div>
          <span className="section-kicker">GIS OVERVIEW</span>
          <h3 id="spatial-map-title">Request locations</h3>
          <p>Showing mapped requests that match the current search and status filters.</p>
        </div>
        <span className="spatial-map-admin-tag">Administrator view</span>
      </div>
      <div className="spatial-map-frame">
        <MapContainer
          className="spatial-map-canvas"
          center={MURANGA_MAP_CENTER}
          zoom={9}
          scrollWheelZoom
          aria-label="Administrator map of service request locations in Murang’a County"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {boundary && <MurangaCountyBoundary boundary={boundary} />}
          {pinnedRequests.map(({ request, position }) => (
            <CircleMarker
              key={request.id}
              center={position}
              radius={8}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: STATUS_COLORS[request.status], fillOpacity: 0.96 }}
            >
              <Popup>
                <div className="spatial-popup">
                  <strong>{request.reference_number}</strong>
                  <span>{request.category}</span>
                  <span className="spatial-popup-status" style={{ color: STATUS_COLORS[request.status] }}>{request.status}</span>
                  <span>{request.location}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {boundaryError && <p className="spatial-map-note" role="status">{boundaryError}</p>}
      <div className="spatial-map-footer">
        <div className="spatial-map-legend" aria-label="Request status marker colours">
          {STATUS_LABELS.map((status) => (
            <span key={status} className="spatial-legend-item">
              <span className="spatial-legend-dot" style={{ backgroundColor: STATUS_COLORS[status] }} />{status}
            </span>
          ))}
        </div>
        <p className="spatial-map-note" aria-live="polite">
          {pinnedRequests.length} pinned · {unpinnedCount} of {requests.length} matching request{requests.length === 1 ? '' : 's'} without a valid pin remain available in the request list.
        </p>
      </div>
      <p className="spatial-map-disclaimer">Location pins are visible to authorised administrators only. The supplied outline shows administrative areas, not wards.</p>
    </section>
  )
}
