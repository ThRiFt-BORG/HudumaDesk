import { useState } from 'react'
import type { Position } from 'geojson'
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import { MURANGA_MAP_CENTER, MurangaCountyBoundary, useMurangaBoundary } from './MurangaCountyBoundary'
import type { MurangaBoundaryData } from './MurangaCountyBoundary'

type RequestLocationPickerProps = {
  value: [number, number] | null
  onChange: (coordinates: [number, number] | null) => void
}

function CaptureMapClick({ onSelect }: { onSelect: (coordinates: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

// GeoJSON coordinates are [longitude, latitude]; a ring's first coordinate is its outer edge.
function pointInRing(point: Position, ring: Position[]) {
  const [longitude, latitude] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const current = ring[i]
    const previous = ring[j]
    if (!current || !previous) continue

    const [currentLon, currentLat] = current
    const [previousLon, previousLat] = previous
    const crossesLatitude = (currentLat > latitude) !== (previousLat > latitude)
    if (
      crossesLatitude
      && longitude < ((previousLon - currentLon) * (latitude - currentLat)) / (previousLat - currentLat) + currentLon
    ) {
      inside = !inside
    }
  }

  return inside
}

function pointInPolygon(point: Position, rings: Position[][]) {
  if (!rings.length || !pointInRing(point, rings[0] ?? [])) return false
  // Any remaining rings are holes and should not be treated as part of the county.
  return !rings.slice(1).some((hole) => pointInRing(point, hole))
}

function isInsideMurangaCounty(latitude: number, longitude: number, boundary: MurangaBoundaryData) {
  const point: Position = [longitude, latitude]

  return boundary.features.some(({ geometry }) => {
    if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates)
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
    }
    return false
  })
}

export default function RequestLocationPicker({ value, onChange }: RequestLocationPickerProps) {
  const { boundary, boundaryError } = useMurangaBoundary()
  const [findingLocation, setFindingLocation] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('This browser does not provide device location. You can tap the map to choose a pin instead.')
      return
    }
    if (!boundary) {
      setLocationMessage('The county boundary is not ready yet. Wait a moment, or tap the map to choose a pin manually.')
      return
    }

    setFindingLocation(true)
    setLocationMessage('Your browser may ask permission to use your location.')

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFindingLocation(false)
        if (!isInsideMurangaCounty(coords.latitude, coords.longitude, boundary)) {
          setLocationMessage('Your detected position is outside the supplied Murang’a boundary. The current pin was not changed; tap the map to place one manually.')
          return
        }
        onChange([coords.latitude, coords.longitude])
        setLocationMessage('Location selected. Confirm that it marks the service issue, not a private home.')
      },
      (error) => {
        setFindingLocation(false)
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage('Location permission was denied. You can still tap the map to place a pin.')
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage('Finding your location timed out. Try again or tap the map to place a pin.')
        } else {
          setLocationMessage('Your location could not be read. You can still tap the map to place a pin.')
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  return (
    <div className="request-map-picker">
      <p className="map-picker-help">Pin the issue on the map if you can. The pin is optional; keep the text location above for a landmark or local directions.</p>
      <button className="button button-quiet" type="button" onClick={useCurrentLocation} disabled={findingLocation}>
        {findingLocation ? 'Finding your location…' : 'Use my current location'}
      </button>
      <p className="field-hint">Your browser asks permission when you press the button. Use GPS only if you are near the service issue; the saved pin is visible to authorised county staff.</p>
      <div className="request-map-frame">
        <MapContainer
          className="request-map-canvas"
          center={MURANGA_MAP_CENTER}
          zoom={9}
          scrollWheelZoom
          aria-label="Optional map picker for a HudumaDesk service request"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {boundary && <MurangaCountyBoundary boundary={boundary} />}
          <CaptureMapClick onSelect={onChange} />
          {value && (
            <CircleMarker center={value} radius={9} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#32735d', fillOpacity: 0.96 }}>
              <Popup>Selected issue location</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      <div className="map-picker-result" aria-live="polite">
        {value ? (
          <>
            <span>Pin selected: {value[0].toFixed(5)}, {value[1].toFixed(5)}</span>
            <button className="button button-quiet map-picker-clear" type="button" onClick={() => onChange(null)}>Remove pin</button>
          </>
        ) : <span>No map pin selected. You can still submit and track this request normally.</span>}
      </div>
      {locationMessage && <p className="field-hint" role="status">{locationMessage}</p>}
      {boundaryError && <p className="field-hint">{boundaryError}</p>}
      <p className="field-hint">Please place the pin near the service issue, not on a private home. It is only shown with request records to authorised county staff.</p>
    </div>
  )
}
