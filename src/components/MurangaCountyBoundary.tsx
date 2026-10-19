import { useEffect, useState } from 'react'
import L from 'leaflet'
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import { GeoJSON as LeafletGeoJSON, useMap } from 'react-leaflet'

export type MurangaBoundaryData = FeatureCollection<Geometry, GeoJsonProperties>
export const MURANGA_MAP_CENTER: [number, number] = [-0.82, 37.05]

const AREA_FILL_COLORS: Record<string, string> = {
  Gatanga: '#5b9bd5',
  Kandara: '#e6a04b',
  Kangema: '#72a879',
  Kigumo: '#aa82c2',
  Kiharu: '#d9766d',
  Maragwa: '#4b9e98',
  Mathioya: '#c0a544',
}

let cachedBoundary: MurangaBoundaryData | null = null
let boundaryRequest: Promise<MurangaBoundaryData> | null = null

function loadMurangaBoundary() {
  if (cachedBoundary) return Promise.resolve(cachedBoundary)
  if (!boundaryRequest) {
    boundaryRequest = fetch('/geojson/muranga-admin2.geojson')
      .then(async (response) => {
        if (!response.ok) throw new Error('County boundary file could not be loaded.')
        return await response.json() as MurangaBoundaryData
      })
      .then((data) => {
        cachedBoundary = data
        return data
      })
      .catch((error: unknown) => {
        boundaryRequest = null
        throw error
      })
  }
  return boundaryRequest
}

export function useMurangaBoundary() {
  const [boundary, setBoundary] = useState<MurangaBoundaryData | null>(cachedBoundary)
  const [boundaryError, setBoundaryError] = useState('')

  useEffect(() => {
    let active = true
    void loadMurangaBoundary()
      .then((data) => { if (active) setBoundary(data) })
      .catch(() => { if (active) setBoundaryError('The area outline could not be loaded; map pins still work.') })
    return () => { active = false }
  }, [])

  return { boundary, boundaryError }
}

function FitCountyBounds({ boundary }: { boundary: MurangaBoundaryData }) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.geoJSON(boundary).getBounds()
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.06), { maxZoom: 10, animate: false })
  }, [boundary, map])

  return null
}

export function MurangaCountyBoundary({ boundary }: { boundary: MurangaBoundaryData }) {
  return (
    <>
      <LeafletGeoJSON
        data={boundary}
        style={(feature) => {
          const areaName = String(feature?.properties?.adm2_name ?? '')
          const fillColor = AREA_FILL_COLORS[areaName] ?? '#4d8e72'
          return { color: '#f8f7f2', weight: 1.5, fillColor, fillOpacity: 0.32 }
        }}
        onEachFeature={(feature, layer) => {
          const areaName = feature.properties?.adm2_name
          if (typeof areaName === 'string' && areaName.trim()) {
            layer.bindTooltip(areaName, { sticky: true, className: 'muranga-boundary-tooltip' })
          }
        }}
      />
      <FitCountyBounds boundary={boundary} />
    </>
  )
}
