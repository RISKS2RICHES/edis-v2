import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { MAPBOX_TOKEN, WAR_ZONES, LOCATION_TYPES } from '../lib/constants'
import { Layers, Plane, Anchor, Flame, AlertTriangle, Crosshair, RefreshCw, MapPin, X, Building, ChevronDown, ChevronUp, ExternalLink, Menu } from 'lucide-react'

mapboxgl.accessToken = MAPBOX_TOKEN

interface LayerState { flights: boolean; maritime: boolean; fires: boolean; disasters: boolean; warzones: boolean; buildings3d: boolean }

interface OpMarker { id: string; lngLat: [number,number]; type: string; label: string; notes: string; timestamp: string }

interface LocationModal {
  lngLat: [number,number]
  address: string
  news: { title: string; source: string; time: string; url: string }[]
  ownership: Record<string,string>
  info: Record<string,string>
  loading: boolean
}

const S = {
  panel: { background:'#0d1117', border:'1px solid #1e2530', borderRadius:2 } as React.CSSProperties,
  hdr: { background:'#0a0c0f', borderBottom:'1px solid #1e2530', padding:'8px 12px', fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'#8b97a8', display:'flex', alignItems:'center', gap:8 },
  row: { fontSize:11, color:'#8b97a8', lineHeight:1.6, marginBottom:4, display:'flex', gap:8, flexWrap:'wrap' as const },
  val: { color:'#e8edf2', flex:1 } as React.CSSProperties,
}

// Fetch location info from open APIs
async function fetchLocationInfo(lng: number, lat: number): Promise<Omit<LocationModal,'loading'>> {
  const lngLat: [number,number] = [lng, lat]
  let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  const ownership: Record<string,string> = {}
  const info: Record<string,string> = {}

  // Reverse geocode
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,place`)
    const d = await r.json()
    if (d.features?.[0]) {
      address = d.features[0].place_name
      const ctx = d.features[0].context || []
      info['Country'] = ctx.find((c:any) => c.id?.startsWith('country'))?.text || ''
      info['Region'] = ctx.find((c:any) => c.id?.startsWith('region'))?.text || ''
      info['City'] = ctx.find((c:any) => c.id?.startsWith('place'))?.text || ''
      info['Postcode'] = ctx.find((c:any) => c.id?.startsWith('postcode'))?.text || ''
    }
  } catch {}

  // OSM building data
  try {
    const delta = 0.0008
    const bbox = `${lat-delta},${lng-delta},${lat+delta},${lng+delta}`
    const q = `[out:json][timeout:8];(way["building"](${bbox});node["amenity"](${bbox});node["shop"](${bbox}););out tags center;`
    const r = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body:`data=${encodeURIComponent(q)}` })
    const d = await r.json()
    const buildings = (d.elements || []).filter((e:any) => e.tags?.building)
    if (buildings.length > 0) {
      const b = buildings[0]
      info['Building Type'] = b.tags.building !== 'yes' ? b.tags.building : 'Structure'
      if (b.tags.name) info['Building Name'] = b.tags.name
      if (b.tags['building:levels']) info['Floors'] = b.tags['building:levels']
      if (b.tags['addr:street']) info['Street'] = `${b.tags['addr:housenumber'] || ''} ${b.tags['addr:street']}`.trim()
      if (b.tags.amenity) info['Use'] = b.tags.amenity
      if (b.tags.operator) ownership['Operator'] = b.tags.operator
      if (b.tags.brand) ownership['Brand'] = b.tags.brand
    }
    const amenities = (d.elements || []).filter((e:any) => e.tags?.amenity || e.tags?.shop)
    if (amenities.length > 0) {
      info['Nearby'] = amenities.slice(0,4).map((a:any) => a.tags.name || a.tags.amenity || a.tags.shop).filter(Boolean).join(', ')
    }
  } catch {}

  // Companies House if UK
  if (info['Country'] === 'United Kingdom' && info['Postcode']) {
    try {
      const r = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(info['Postcode'])}&items_per_page=3`)
      if (r.ok) {
        const d = await r.json()
        const companies = (d.items || []).slice(0,2)
        if (companies.length > 0) {
          ownership['Registered Companies'] = companies.map((c:any) => c.title).join(', ')
          ownership['Companies House'] = `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(info['Postcode'])}`
        }
      }
    } catch {}
  }

  // News from location
  const cityName = info['City'] || info['Region'] || info['Country'] || address.split(',')[0]
  const news: LocationModal['news'] = [
    { title: `Security update: ${cityName} area monitoring active`, source: 'E-DIS Intelligence', time: new Date().toISOString(), url: '#' },
    { title: `Open-source data aggregation for ${cityName}`, source: 'OSINT Feed', time: new Date(Date.now()-3600000).toISOString(), url: `https://www.google.com/search?q=${encodeURIComponent(cityName+' news')}` },
  ]

  // Nominatim for additional detail
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, { headers:{ 'Accept-Language':'en' } })
    const d = await r.json()
    if (d.address) {
      if (d.address.house_number) info['House Number'] = d.address.house_number
      if (d.address.road) info['Road'] = d.address.road
      if (d.address.suburb) info['Suburb'] = d.address.suburb
      if (d.display_name) info['Full Address'] = d.display_name
    }
    if (d.osm_type && d.osm_id) {
      ownership['OSM Record'] = `https://www.openstreetmap.org/${d.osm_type}/${d.osm_id}`
    }
  } catch {}

  info['Coordinates'] = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  info['What3Words'] = `https://what3words.com/map?lng=${lng}&lat=${lat}`
  info['Google Maps'] = `https://www.google.com/maps?q=${lat},${lng}`
  info['Satellite View'] = `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e3`
  ownership['Land Registry (UK)'] = `https://search-property-information.service.gov.uk/search/search-by-address?postcode=${encodeURIComponent(info['Postcode']||'')}`
  ownership['192.com Search'] = `https://www.192.com/places/${encodeURIComponent(cityName)}`

  return { lngLat, address, news, ownership, info }
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const opMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())

  const [layers, setLayers] = useState<LayerState>({ flights:true, maritime:true, fires:true, disasters:true, warzones:true, buildings3d:true })
  const [layerOpen, setLayerOpen] = useState(true)
  const [stats, setStats] = useState({ flights:0, ships:0, fires:0, disasters:0 })
  const [loading, setLoading] = useState(false)
  const [selectedZone, setSelectedZone] = useState<typeof WAR_ZONES[0]|null>(null)
  const [locationModal, setLocationModal] = useState<LocationModal|null>(null)
  const [opMarkers, setOpMarkers] = useState<OpMarker[]>([])
  const [addingMarker, setAddingMarker] = useState(false)
  const [pendingMarker, setPendingMarker] = useState<{lngLat:[number,number];type:string;label:string;notes:string}|null>(null)
  const [opPanelOpen, setOpPanelOpen] = useState(false)
  const [routeMode, setRouteMode] = useState(false)
  const [routePoints, setRoutePoints] = useState<[number,number][]>([])
  
  // Mobile panel states
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false)
  const [mobileOpsOpen, setMobileOpsOpen] = useState(false)

  const clearDataMarkers = () => { markersRef.current.forEach(m => m.remove()); markersRef.current = [] }

  const addDataMarker = (el: HTMLElement, lng: number, lat: number, popup: mapboxgl.Popup) => {
    if (!map.current) return
    const m = new mapboxgl.Marker({ element: el }).setLngLat([lng,lat]).setPopup(popup).addTo(map.current)
    markersRef.current.push(m)
  }

  const add3DBuildings = useCallback(() => {
    if (!map.current) return
    const m = map.current
    if (!m.getSource('mapbox-dem')) {
      m.addSource('mapbox-dem', { type:'raster-dem', url:'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize:512, maxzoom:14 })
      m.setTerrain({ source:'mapbox-dem', exaggeration:1.2 })
    }
    if (!m.getLayer('3d-buildings')) {
      m.addLayer({
        id: '3d-buildings', source:'composite', 'source-layer':'building',
        filter:['==','extrude','true'], type:'fill-extrusion', minzoom:14,
        paint: {
          'fill-extrusion-color': '#1a2535',
          'fill-extrusion-height': ['interpolate',['linear'],['zoom'],14,0,14.05,['get','height']],
          'fill-extrusion-base': ['interpolate',['linear'],['zoom'],14,0,14.05,['get','min_height']],
          'fill-extrusion-opacity': 0.9,
        }
      })
    }
    m.setLayoutProperty('3d-buildings', 'visibility', layers.buildings3d ? 'visible' : 'none')
  }, [layers.buildings3d])

  const addWarzones = useCallback(() => {
    if (!map.current) return
    const m = map.current
    WAR_ZONES.forEach(z => {
      const srcId = `wz-${z.id}`, fillId = `wz-fill-${z.id}`, lineId = `wz-line-${z.id}`
      if (!m.getSource(srcId)) {
        m.addSource(srcId, { type:'geojson', data:{ type:'Feature', properties:{id:z.id}, geometry:{ type:'Polygon', coordinates:[z.coordinates] } } })
        m.addLayer({ id:fillId, type:'fill', source:srcId,
          paint:{ 'fill-color': z.severity==='CRITICAL'?'#ff0000':z.severity==='HIGH'?'#cc2200':'#aa3300', 'fill-opacity':0.15 } })
        m.addLayer({ id:lineId, type:'line', source:srcId,
          paint:{ 'line-color':'#ff3b3b', 'line-width':1.5, 'line-dasharray':[3,2] } })
        m.on('click', fillId, () => setSelectedZone(z))
        m.on('mouseenter', fillId, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', fillId, () => { m.getCanvas().style.cursor = '' })
      }
      m.setLayoutProperty(fillId, 'visibility', layers.warzones ? 'visible':'none')
      m.setLayoutProperty(lineId, 'visibility', layers.warzones ? 'visible':'none')
    })
  }, [layers.warzones])

  const loadFlights = useCallback(async () => {
    if (!map.current || !layers.flights) return
    try {
      const r = await fetch('https://opensky-network.org/api/states/all?lamin=35&lomin=-30&lamax=70&lomax=45')
      if (!r.ok) throw new Error('no data')
      const d = await r.json()
      const flights = (d.states||[]).slice(0,120).map((s:any) => ({
        icao:s[0], callsign:(s[1]||'').trim(), country:s[2], lng:s[5], lat:s[6], alt:s[7], vel:s[9], hdg:s[10]
      })).filter((f:any) => f.lng && f.lat)
      setStats(p => ({...p, flights:flights.length}))
      flights.forEach((f:any) => {
        const el = document.createElement('div')
        el.className = 'marker-flight'
        el.style.transform = `rotate(${f.hdg||0}deg)`
        el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1e6fff"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`
        const popup = new mapboxgl.Popup({ offset:12, closeButton:false }).setHTML(`
          <div class="mono" style="font-size:11px;line-height:1.7">
            <div style="color:#1e6fff;font-weight:700;margin-bottom:4px">${f.callsign||f.icao}</div>
            <div style="color:#8b97a8">Country: <span style="color:#e8edf2">${f.country}</span></div>
            <div style="color:#8b97a8">Alt: <span style="color:#e8edf2">${f.alt?Math.round(f.alt)+'m':'—'}</span></div>
            <div style="color:#8b97a8">Speed: <span style="color:#e8edf2">${f.vel?Math.round(f.vel*1.944)+'kn':'—'}</span></div>
            <div style="color:#4a5568;font-size:9px;margin-top:3px">${f.icao.toUpperCase()}</div>
          </div>`)
        addDataMarker(el, f.lng, f.lat, popup)
      })
    } catch {}
  }, [layers.flights])

  const loadMaritime = useCallback(async () => {
    if (!map.current || !layers.maritime) return
    const ships = [
      { mmsi:'235123456', name:'ATLANTIC VOYAGER', type:'Cargo', lat:51.5, lng:-2.5, speed:12.4, hdg:270, flag:'GBR' },
      { mmsi:'235789012', name:'NORTH SEA TRADER', type:'Tanker', lat:54.2, lng:3.1, speed:8.2, hdg:45, flag:'NOR' },
      { mmsi:'538123456', name:'PACIFIC BRIDGE', type:'Container', lat:48.3, lng:-4.8, speed:18.1, hdg:180, flag:'MHL' },
      { mmsi:'311000456', name:'CARIBOU SPIRIT', type:'Tanker', lat:38.7, lng:-9.1, speed:14.5, hdg:320, flag:'BHS' },
      { mmsi:'229123456', name:'MEDITERRANEAN STAR', type:'Cargo', lat:36.5, lng:14.2, speed:11.0, hdg:90, flag:'MLT' },
      { mmsi:'219123456', name:'NORDIC PEARL', type:'Passenger', lat:57.1, lng:9.8, speed:16.3, hdg:200, flag:'DNK' },
      { mmsi:'244123456', name:'ROTTERDAM EXPRESS', type:'Container', lat:51.9, lng:4.5, speed:5.2, hdg:270, flag:'NLD' },
      { mmsi:'636123456', name:'OCEAN GUARDIAN', type:'Cargo', lat:4.2, lng:-7.5, speed:13.8, hdg:120, flag:'LBR' },
    ]
    setStats(p => ({...p, ships:ships.length}))
    ships.forEach(s => {
      const el = document.createElement('div')
      el.className = 'marker-ship'
      el.style.cssText = `width:12px;height:14px;cursor:pointer;transform:rotate(${s.hdg}deg);display:flex;align-items:center;`
      el.innerHTML = `<svg width="12" height="14" viewBox="0 0 12 16" fill="#00d4ff"><path d="M6 0 L12 14 L6 10 L0 14 Z"/></svg>`
      const popup = new mapboxgl.Popup({ offset:12, closeButton:false }).setHTML(`
        <div class="mono" style="font-size:11px;line-height:1.7">
          <div style="color:#00d4ff;font-weight:700;margin-bottom:4px">${s.name}</div>
          <div style="color:#8b97a8">Type: <span style="color:#e8edf2">${s.type}</span></div>
          <div style="color:#8b97a8">Flag: <span style="color:#e8edf2">${s.flag}</span></div>
          <div style="color:#8b97a8">Speed: <span style="color:#e8edf2">${s.speed}kn</span></div>
          <div style="color:#4a5568;font-size:9px;margin-top:3px">MMSI: ${s.mmsi}</div>
        </div>`)
      addDataMarker(el, s.lng, s.lat, popup)
    })
  }, [layers.maritime])

  const loadFires = useCallback(async () => {
    if (!map.current || !layers.fires) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/1980401/VIIRS_SNPP_NRT/world/1/${today}`)
      if (!r.ok) throw new Error('no data')
      const text = await r.text()
      const lines = text.trim().split('\n').slice(1)
      const fires = lines.slice(0,150).map(l => { const p=l.split(','); return {lat:parseFloat(p[0]),lng:parseFloat(p[1]),brightness:parseFloat(p[2]||'300'),date:p[5]||''} }).filter(f=>!isNaN(f.lat)&&!isNaN(f.lng))
      setStats(p => ({...p, fires:fires.length}))
      fires.forEach(f => {
        const el = document.createElement('div')
        const i = Math.min(1,(f.brightness-300)/200)
        el.className='marker-fire'
        el.style.cssText=`width:9px;height:9px;border-radius:50%;cursor:pointer;background:${i>0.7?'#ff0000':i>0.4?'#ff4500':'#ff8c00'};border:1px solid currentColor;animation:pulse-live 1.5s infinite;`
        const popup = new mapboxgl.Popup({ offset:8, closeButton:false }).setHTML(`
          <div class="mono" style="font-size:11px;line-height:1.6">
            <div style="color:#ff4500;font-weight:700;margin-bottom:4px">ACTIVE FIRE</div>
            <div style="color:#8b97a8">Brightness: <span style="color:#e8edf2">${Math.round(f.brightness)}K</span></div>
            <div style="color:#8b97a8">Date: <span style="color:#e8edf2">${f.date}</span></div>
            <div style="color:#4a5568;font-size:9px;margin-top:3px">NASA FIRMS VIIRS</div>
          </div>`)
        addDataMarker(el, f.lng, f.lat, popup)
      })
    } catch {}
  }, [layers.fires])

  const loadDisasters = useCallback(async () => {
    if (!map.current || !layers.disasters) return
    try {
      const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=40')
      if (!r.ok) throw new Error()
      const d = await r.json()
      const events = (d.events||[]).map((e:any) => {
        const g = e.geometry?.[0]; if (!g) return null
        return { id:e.id, title:e.title, type:e.categories?.[0]?.title||'Event', lat:g.coordinates[1], lng:g.coordinates[0], date:g.date }
      }).filter(Boolean)
      setStats(p => ({...p, disasters:events.length}))
      events.forEach((ev:any) => {
        const el = document.createElement('div')
        el.className='marker-disaster'
        el.style.cssText='width:14px;height:14px;cursor:pointer;background:#ffb800;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);'
        const popup = new mapboxgl.Popup({ offset:10, closeButton:false }).setHTML(`
          <div class="mono" style="font-size:11px;line-height:1.6">
            <div style="color:#ffb800;font-weight:700;margin-bottom:4px">${ev.type.toUpperCase()}</div>
            <div style="color:#e8edf2">${ev.title}</div>
            <div style="color:#4a5568;font-size:9px;margin-top:3px">NASA EONET · ${new Date(ev.date).toLocaleDateString()}</div>
          </div>`)
        addDataMarker(el, ev.lng, ev.lat, popup)
      })
    } catch {}
  }, [layers.disasters])

  const refreshAll = useCallback(async () => {
    clearDataMarkers()
    setLoading(true)
    await Promise.allSettled([loadFlights(), loadMaritime(), loadFires(), loadDisasters()])
    setLoading(false)
  }, [loadFlights, loadMaritime, loadFires, loadDisasters])

  // Render op markers on map
  const renderOpMarker = useCallback((op: OpMarker) => {
    if (!map.current) return
    const existing = opMarkersRef.current.get(op.id)
    if (existing) existing.remove()
    const locType = LOCATION_TYPES.find(t => t.id === op.type) || LOCATION_TYPES[6]
    const el = document.createElement('div')
    el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${locType.color}22;border:2px solid ${locType.color};display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 10px ${locType.color}66;font-size:12px;`
    el.title = `${locType.label}: ${op.label}`
    const popup = new mapboxgl.Popup({ offset:16, closeButton:true }).setHTML(`
      <div style="font-family:'IBM Plex Sans',system-ui;font-size:12px;min-width:180px">
        <div style="color:${locType.color};font-weight:700;margin-bottom:6px;font-size:13px">${locType.label}</div>
        <div style="color:#e8edf2;margin-bottom:4px">${op.label}</div>
        ${op.notes ? `<div style="color:#8b97a8;font-size:11px;margin-top:4px">${op.notes}</div>` : ''}
        <div class="mono" style="color:#4a5568;font-size:9px;margin-top:6px">${op.lngLat[1].toFixed(5)}, ${op.lngLat[0].toFixed(5)}</div>
        <div class="mono" style="color:#4a5568;font-size:9px">${new Date(op.timestamp).toLocaleString()}</div>
      </div>`)
    const m = new mapboxgl.Marker({ element: el }).setLngLat(op.lngLat).setPopup(popup).addTo(map.current!)
    opMarkersRef.current.set(op.id, m)
  }, [])

  // Draw route on map
  const drawRoute = useCallback(async (points: [number,number][]) => {
    if (!map.current || points.length < 2) return
    try {
      const coords = points.map(p => p.join(',')).join(';')
      const r = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}`)
      if (!r.ok) return
      const d = await r.json()
      const geom = d.routes?.[0]?.geometry
      if (!geom) return
      const m = map.current
      if (m.getLayer('op-route')) m.removeLayer('op-route')
      if (m.getLayer('op-route-glow')) m.removeLayer('op-route-glow')
      if (m.getSource('op-route')) m.removeSource('op-route')
      m.addSource('op-route', { type:'geojson', data:{ type:'Feature', properties:{}, geometry:geom } })
      m.addLayer({ id:'op-route-glow', type:'line', source:'op-route', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':'#1e6fff', 'line-width':8, 'line-opacity':0.2 } })
      m.addLayer({ id:'op-route', type:'line', source:'op-route', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':'#1e6fff', 'line-width':2.5, 'line-dasharray':[2,1] } })
      const dist = (d.routes[0].distance/1000).toFixed(1)
      const mins = Math.round(d.routes[0].duration/60)
      const el = document.createElement('div')
      el.style.cssText='background:#0d1117;border:1px solid #1e6fff;border-radius:2px;padding:6px 10px;font-family:JetBrains Mono,monospace;font-size:11px;color:#e8edf2;white-space:nowrap;'
      el.innerHTML=`<span style="color:#1e6fff">${dist}km</span> · ~${mins} min`
      const mid = Math.floor(points.length/2)
      new mapboxgl.Marker({ element:el }).setLngLat(points[mid]).addTo(m)
    } catch {}
  }, [])

  useEffect(() => {
    if (!mapContainer.current || map.current) return
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [15, 30], zoom: 2.5, pitch: 30, bearing: 0,
      antialias: true,
    })
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    map.current.on('load', () => {
      add3DBuildings()
      addWarzones()
      refreshAll()
    })
    // Right-click for location info
    map.current.on('contextmenu', (e) => {
      const { lng, lat } = e.lngLat
      setLocationModal({ lngLat:[lng,lat], address:'', news:[], ownership:{}, info:{}, loading:true })
      fetchLocationInfo(lng, lat).then(data => setLocationModal({ ...data, loading:false }))
    })
    const interval = setInterval(() => { clearDataMarkers(); loadFlights(); loadMaritime() }, 90000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    if (layers.buildings3d) add3DBuildings()
    else if (map.current.getLayer('3d-buildings')) map.current.setLayoutProperty('3d-buildings','visibility','none')
  }, [layers.buildings3d, add3DBuildings])

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    addWarzones()
  }, [layers.warzones, addWarzones])

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    clearDataMarkers()
    refreshAll()
  }, [layers.flights, layers.maritime, layers.fires, layers.disasters])

  // Map click handler for adding op markers or route points
  useEffect(() => {
    if (!map.current) return
    const m = map.current
    const handler = (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      if (routeMode) {
        const newPoints: [number,number][] = [...routePoints, [lng,lat]]
        setRoutePoints(newPoints)
        // Add waypoint dot
        const el = document.createElement('div')
        el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${newPoints.length===1?'#00ff88':'#1e6fff'};border:2px solid #fff;cursor:pointer;`
        new mapboxgl.Marker({ element:el }).setLngLat([lng,lat]).addTo(m)
        if (newPoints.length >= 2) drawRoute(newPoints)
        return
      }
      if (addingMarker) {
        setPendingMarker({ lngLat:[lng,lat], type:'waypoint', label:'', notes:'' })
        setAddingMarker(false)
        m.getCanvas().style.cursor = ''
      }
    }
    m.on('click', handler)
    return () => { m.off('click', handler) }
  }, [addingMarker, routeMode, routePoints, drawRoute])

  useEffect(() => {
    if (!map.current) return
    map.current.getCanvas().style.cursor = addingMarker ? 'crosshair' : routeMode ? 'crosshair' : ''
  }, [addingMarker, routeMode])

  const saveOpMarker = () => {
    if (!pendingMarker || !pendingMarker.label.trim()) return
    const op: OpMarker = { id: Date.now().toString(), ...pendingMarker, timestamp: new Date().toISOString() }
    setOpMarkers(prev => [...prev, op])
    renderOpMarker(op)
    setPendingMarker(null)
  }

  const removeOpMarker = (id: string) => {
    const m = opMarkersRef.current.get(id)
    if (m) { m.remove(); opMarkersRef.current.delete(id) }
    setOpMarkers(prev => prev.filter(o => o.id !== id))
  }

  const clearRoute = () => {
    if (!map.current) return
    const m = map.current
    if (m.getLayer('op-route')) m.removeLayer('op-route')
    if (m.getLayer('op-route-glow')) m.removeLayer('op-route-glow')
    if (m.getSource('op-route')) m.removeSource('op-route')
    setRoutePoints([])
    setRouteMode(false)
  }

  const LAYERS_CONFIG = [
    { key:'flights', label:'Flights', count:stats.flights, color:'#1e6fff', icon:Plane },
    { key:'maritime', label:'Maritime', count:stats.ships, color:'#00d4ff', icon:Anchor },
    { key:'fires', label:'Active Fires', count:stats.fires, color:'#ff4500', icon:Flame },
    { key:'disasters', label:'Disasters', count:stats.disasters, color:'#ffb800', icon:AlertTriangle },
    { key:'warzones', label:'War Zones', count:WAR_ZONES.length, color:'#ff3b3b', icon:Crosshair },
    { key:'buildings3d', label:'3D Buildings', count:0, color:'#a855f7', icon:Building },
  ]

  // Close mobile panels
  const closeMobilePanels = () => {
    setMobileLayersOpen(false)
    setMobileOpsOpen(false)
  }

  return (
    <div style={{ position:'relative', width:'100%', height:'100%' }}>
      <div ref={mapContainer} style={{ width:'100%', height:'100%' }} />

      {/* Mobile panel overlay */}
      <div 
        className={`slide-panel-overlay ${mobileLayersOpen || mobileOpsOpen ? 'slide-panel-overlay-open' : ''}`}
        onClick={closeMobilePanels}
      />

      {/* Mobile FAB buttons */}
      <button 
        className="mobile-fab mobile-fab-left hide-desktop"
        onClick={() => { setMobileLayersOpen(true); setMobileOpsOpen(false) }}
        aria-label="Open layers"
      >
        <Layers size={20} />
      </button>
      <button 
        className="mobile-fab mobile-fab-right hide-desktop"
        onClick={() => { setMobileOpsOpen(true); setMobileLayersOpen(false) }}
        aria-label="Open operations"
      >
        <MapPin size={20} />
      </button>

      {/* Layers panel - Desktop */}
      <div className="hide-mobile" style={{ position:'absolute', top:12, left:12, zIndex:10, width:196, ...S.panel }}>
        <button onClick={() => setLayerOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', color:'#e8edf2' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}><Layers size={13} color="#1e6fff" /><span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Layers</span></div>
          {layerOpen ? <ChevronUp size={11} color="#4a5568" /> : <ChevronDown size={11} color="#4a5568" />}
        </button>
        {layerOpen && (
          <div style={{ padding:'6px 10px 10px', borderTop:'1px solid #1e2530' }}>
            {LAYERS_CONFIG.map(l => {
              const Icon = l.icon
              const active = layers[l.key as keyof LayerState]
              return (
                <label key={l.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0', cursor:'pointer', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <input type="checkbox" checked={active} onChange={e => setLayers(p=>({...p,[l.key]:e.target.checked}))} style={{ width:11, height:11, accentColor:l.color, cursor:'pointer' }} />
                    <Icon size={11} color={active?l.color:'#4a5568'} />
                    <span style={{ fontSize:11, color:active?'#e8edf2':'#4a5568' }}>{l.label}</span>
                  </div>
                  {l.count>0 && <span style={{ fontSize:9, color:l.color, fontFamily:'JetBrains Mono,monospace' }}>{l.count}</span>}
                </label>
              )
            })}
            <button onClick={refreshAll} disabled={loading} className="btn btn-ghost" style={{ marginTop:8, width:'100%', padding:'5px', fontSize:10, justifyContent:'center' }}>
              <RefreshCw size={10} style={{ animation:loading?'spin 1s linear infinite':'none' }} />
              {loading?'Refreshing…':'Refresh Data'}
            </button>
          </div>
        )}
      </div>

      {/* Layers panel - Mobile slide-out */}
      <div 
        className={`slide-panel slide-panel-left hide-desktop ${mobileLayersOpen ? 'slide-panel-open' : ''}`}
        style={{ width: 280, maxWidth: '85vw', paddingTop: 12 }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px', borderBottom:'1px solid #1e2530' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Layers size={16} color="#1e6fff" />
            <span style={{ fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#e8edf2' }}>Layers</span>
          </div>
          <button onClick={() => setMobileLayersOpen(false)} style={{ background:'none', border:'none', color:'#8b97a8', cursor:'pointer', padding:4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding:'12px 16px' }}>
          {LAYERS_CONFIG.map(l => {
            const Icon = l.icon
            const active = layers[l.key as keyof LayerState]
            return (
              <label key={l.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', cursor:'pointer', gap:10, borderBottom:'1px solid #1e2530' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="checkbox" checked={active} onChange={e => setLayers(p=>({...p,[l.key]:e.target.checked}))} style={{ width:16, height:16, accentColor:l.color, cursor:'pointer' }} />
                  <Icon size={16} color={active?l.color:'#4a5568'} />
                  <span style={{ fontSize:13, color:active?'#e8edf2':'#8b97a8' }}>{l.label}</span>
                </div>
                {l.count>0 && <span style={{ fontSize:11, color:l.color, fontFamily:'JetBrains Mono,monospace' }}>{l.count}</span>}
              </label>
            )
          })}
          <button onClick={() => { refreshAll(); setMobileLayersOpen(false) }} disabled={loading} className="btn btn-primary" style={{ marginTop:16, width:'100%', padding:'10px', fontSize:12, justifyContent:'center' }}>
            <RefreshCw size={14} style={{ animation:loading?'spin 1s linear infinite':'none' }} />
            {loading?'Refreshing…':'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Operations panel - Desktop */}
      <div className="hide-mobile" style={{ position:'absolute', top:12, right:12, zIndex:10, width:220, ...S.panel }}>
        <button onClick={() => setOpPanelOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', color:'#e8edf2' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}><MapPin size={13} color="#1e6fff" /><span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Operations</span></div>
          {opPanelOpen ? <ChevronUp size={11} color="#4a5568" /> : <ChevronDown size={11} color="#4a5568" />}
        </button>
        {opPanelOpen && (
          <div style={{ padding:'8px 10px 10px', borderTop:'1px solid #1e2530' }}>
            <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>Mark Location</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
              {LOCATION_TYPES.slice(0,6).map(lt => (
                <button key={lt.id} onClick={() => { setAddingMarker(true); setPendingMarker(p => p ? {...p,type:lt.id} : { lngLat:[0,0], type:lt.id, label:'', notes:'' }) }} className="btn btn-ghost" style={{ padding:'4px 6px', fontSize:9, justifyContent:'flex-start', gap:4, borderLeft:`2px solid ${lt.color}` }}>
                  <span style={{ color:lt.color }}>◆</span> {lt.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom:8 }}>
              <button onClick={() => { setRouteMode(v=>!v); if(routeMode) clearRoute() }} className={`btn ${routeMode?'btn-danger':'btn-ghost'}`} style={{ width:'100%', justifyContent:'center', fontSize:10 }}>
                {routeMode ? 'Cancel Route' : 'Plan Covert Route'}
              </button>
              {routeMode && <div style={{ fontSize:9, color:'#1e6fff', marginTop:4, textAlign:'center', lineHeight:1.4 }}>Click map to add waypoints. Route auto-calculates.</div>}
              {routePoints.length > 0 && !routeMode && (
                <button onClick={clearRoute} className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:10, marginTop:4 }}>Clear Route</button>
              )}
            </div>
            {opMarkers.length > 0 && (
              <div>
                <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Marked Locations ({opMarkers.length})</div>
                <div style={{ maxHeight:120, overflowY:'auto' }}>
                  {opMarkers.map(op => {
                    const lt = LOCATION_TYPES.find(t=>t.id===op.type)||LOCATION_TYPES[6]
                    return (
                      <div key={op.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid #1e2530' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:lt.color, flexShrink:0 }} />
                        <div style={{ flex:1, fontSize:10, color:'#e8edf2', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{op.label}</div>
                        <button onClick={() => {
                          if (map.current) map.current.flyTo({ center:op.lngLat, zoom:16, pitch:50 })
                        }} style={{ background:'none', border:'none', color:'#1e6fff', cursor:'pointer', padding:2, fontSize:9 }}>Go</button>
                        <button onClick={() => removeOpMarker(op.id)} style={{ background:'none', border:'none', color:'#ff3b3b', cursor:'pointer', padding:2 }}><X size={9} /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div style={{ marginTop:8, fontSize:9, color:'#4a5568', lineHeight:1.5 }}>Right-click map for location intelligence</div>
          </div>
        )}
      </div>

      {/* Operations panel - Mobile slide-out */}
      <div 
        className={`slide-panel hide-desktop ${mobileOpsOpen ? 'slide-panel-open' : ''}`}
        style={{ width: 300, maxWidth: '90vw', right: 0, paddingTop: 12 }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px', borderBottom:'1px solid #1e2530' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <MapPin size={16} color="#1e6fff" />
            <span style={{ fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#e8edf2' }}>Operations</span>
          </div>
          <button onClick={() => setMobileOpsOpen(false)} style={{ background:'none', border:'none', color:'#8b97a8', cursor:'pointer', padding:4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding:'12px 16px', overflowY:'auto', maxHeight:'calc(100vh - 60px)' }}>
          <div style={{ fontSize:10, color:'#4a5568', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>Mark Location</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:12 }}>
            {LOCATION_TYPES.slice(0,6).map(lt => (
              <button key={lt.id} onClick={() => { setAddingMarker(true); setPendingMarker(p => p ? {...p,type:lt.id} : { lngLat:[0,0], type:lt.id, label:'', notes:'' }); setMobileOpsOpen(false) }} className="btn btn-ghost" style={{ padding:'8px 10px', fontSize:11, justifyContent:'flex-start', gap:6, borderLeft:`3px solid ${lt.color}` }}>
                <span style={{ color:lt.color }}>◆</span> {lt.label}
              </button>
            ))}
          </div>
          <div style={{ marginBottom:12 }}>
            <button onClick={() => { setRouteMode(v=>!v); if(routeMode) clearRoute(); setMobileOpsOpen(false) }} className={`btn ${routeMode?'btn-danger':'btn-ghost'}`} style={{ width:'100%', justifyContent:'center', fontSize:12, padding:'10px' }}>
              {routeMode ? 'Cancel Route' : 'Plan Covert Route'}
            </button>
            {routeMode && <div style={{ fontSize:10, color:'#1e6fff', marginTop:6, textAlign:'center', lineHeight:1.4 }}>Click map to add waypoints.</div>}
            {routePoints.length > 0 && !routeMode && (
              <button onClick={clearRoute} className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12, marginTop:6, padding:'10px' }}>Clear Route</button>
            )}
          </div>
          {opMarkers.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:'#4a5568', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>Marked Locations ({opMarkers.length})</div>
              <div style={{ maxHeight:200, overflowY:'auto' }}>
                {opMarkers.map(op => {
                  const lt = LOCATION_TYPES.find(t=>t.id===op.type)||LOCATION_TYPES[6]
                  return (
                    <div key={op.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid #1e2530' }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:lt.color, flexShrink:0 }} />
                      <div style={{ flex:1, fontSize:12, color:'#e8edf2', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{op.label}</div>
                      <button onClick={() => {
                        if (map.current) map.current.flyTo({ center:op.lngLat, zoom:16, pitch:50 })
                        setMobileOpsOpen(false)
                      }} style={{ background:'#1e2530', border:'1px solid #2d3748', borderRadius:2, color:'#1e6fff', cursor:'pointer', padding:'4px 8px', fontSize:10 }}>Go</button>
                      <button onClick={() => removeOpMarker(op.id)} style={{ background:'#1e2530', border:'1px solid #2d3748', borderRadius:2, color:'#ff3b3b', cursor:'pointer', padding:'4px 6px' }}><X size={12} /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop:12, fontSize:10, color:'#4a5568', lineHeight:1.5, background:'#111519', padding:'8px 10px', borderRadius:2 }}>
            Long-press or right-click map for location intelligence
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="hide-mobile" style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:10, background:'rgba(13,17,23,0.92)', border:'1px solid #1e2530', borderRadius:2, padding:'6px 16px', display:'flex', gap:20, backdropFilter:'blur(4px)' }}>
        {[{l:'FLIGHTS',v:stats.flights,c:'#1e6fff'},{l:'VESSELS',v:stats.ships,c:'#00d4ff'},{l:'FIRES',v:stats.fires,c:'#ff4500'},{l:'EVENTS',v:stats.disasters,c:'#ffb800'}].map(s => (
          <div key={s.l} style={{ textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:700, color:s.c, fontFamily:'JetBrains Mono,monospace' }}>{s.v}</div>
            <div style={{ fontSize:8, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Mobile stats bar */}
      <div className="hide-desktop" style={{ position:'absolute', top:8, left:8, right:8, zIndex:5, background:'rgba(13,17,23,0.92)', border:'1px solid #1e2530', borderRadius:2, padding:'6px 12px', display:'flex', justifyContent:'space-around', backdropFilter:'blur(4px)' }}>
        {[{l:'FLT',v:stats.flights,c:'#1e6fff'},{l:'VES',v:stats.ships,c:'#00d4ff'},{l:'FIR',v:stats.fires,c:'#ff4500'},{l:'EVT',v:stats.disasters,c:'#ffb800'}].map(s => (
          <div key={s.l} style={{ textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:700, color:s.c, fontFamily:'JetBrains Mono,monospace' }}>{s.v}</div>
            <div style={{ fontSize:7, color:'#4a5568', letterSpacing:'0.08em', textTransform:'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Add marker dialog */}
      {addingMarker && !pendingMarker && (
        <div style={{ position:'absolute', bottom:80, left:'50%', transform:'translateX(-50%)', zIndex:20, background:'#0d1117', border:'1px solid #1e6fff', borderRadius:2, padding:'10px 20px', fontSize:12, color:'#1e6fff', letterSpacing:'0.08em', textTransform:'uppercase' }}>
          Click map to place marker
        </div>
      )}

      {/* Pending marker form */}
      {pendingMarker && (
        <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) setPendingMarker(null) }}>
          <div className="modal-box" style={{ maxWidth:380, margin:'16px' }}>
            <div style={S.hdr}>
              <MapPin size={13} color="#1e6fff" />
              Add Operational Marker
              <button onClick={() => setPendingMarker(null)} style={{ marginLeft:'auto', background:'none', border:'none', color:'#4a5568', cursor:'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ padding:16 }}>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:4 }}>Location Type</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  {LOCATION_TYPES.map(lt => (
                    <button key={lt.id} onClick={() => setPendingMarker(p => p?{...p,type:lt.id}:p)} className="btn btn-ghost" style={{ padding:'5px 8px', fontSize:10, justifyContent:'flex-start', gap:5, borderLeft:`2px solid ${pendingMarker.type===lt.id?lt.color:'#2d3748'}`, background:pendingMarker.type===lt.id?lt.color+'22':'#1e2530' }}>
                      <span style={{ color:lt.color }}>◆</span>{lt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:4 }}>Label *</label>
                <input value={pendingMarker.label} onChange={e => setPendingMarker(p => p?{...p,label:e.target.value}:p)} placeholder="Site designation / name" style={{ width:'100%', padding:'10px 12px', fontSize:14 }} />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label>
                <textarea value={pendingMarker.notes} onChange={e => setPendingMarker(p => p?{...p,notes:e.target.value}:p)} placeholder="Intelligence notes…" rows={3} style={{ width:'100%', padding:'10px 12px', fontSize:14, resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={saveOpMarker} disabled={!pendingMarker.label.trim()} className="btn btn-primary" style={{ flex:1, justifyContent:'center', padding:'10px' }}>Confirm Marker</button>
                <button onClick={() => setPendingMarker(null)} className="btn btn-ghost" style={{ padding:'10px 16px' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* War zone panel */}
      {selectedZone && (
        <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) setSelectedZone(null) }}>
          <div className="modal-box" style={{ maxWidth:400, margin:'16px' }}>
            <div style={S.hdr}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#ff3b3b', animation:'pulse-live 1.5s infinite' }} />
              Active Conflict
              <button onClick={() => setSelectedZone(null)} style={{ marginLeft:'auto', background:'none', border:'none', color:'#4a5568', cursor:'pointer' }}><X size={13} /></button>
            </div>
            <div style={{ padding:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#ff3b3b', marginBottom:10 }}>{selectedZone.name}</div>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                <span className="tag" style={{ background:'#3d0000', color:'#ff3b3b', border:'1px solid #ff3b3b55' }}>{selectedZone.severity}</span>
                <span className="tag" style={{ background:'#1e2530', color:'#8b97a8' }}>Since {selectedZone.startDate}</span>
              </div>
              <p style={{ fontSize:13, color:'#8b97a8', lineHeight:1.6, marginBottom:12 }}>{selectedZone.summary}</p>
              <div style={{ background:'#0a0c0f', border:'1px solid #1e2530', borderRadius:2, padding:'10px 12px', marginBottom:10 }}>
                <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Latest Update</div>
                <div style={{ fontSize:13, color:'#e8edf2', lineHeight:1.5 }}>{selectedZone.latestUpdate}</div>
              </div>
              <div style={{ fontSize:12, color:'#8b97a8' }}>Casualties: <span style={{ color:'#ff8c00', fontFamily:'JetBrains Mono,monospace' }}>{selectedZone.casualties}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Location modal */}
      {locationModal && (
        <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) setLocationModal(null) }}>
          <div className="modal-box" style={{ margin:'16px' }}>
            <div style={S.hdr}>
              <Building size={13} color="#1e6fff" />
              Location Intelligence
              {!locationModal.loading && <span style={{ marginLeft:'auto', fontSize:9, color:'#00ff88' }}>DATA RETRIEVED</span>}
              <button onClick={() => setLocationModal(null)} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', marginLeft: locationModal.loading ? 'auto' : 8 }}><X size={14} /></button>
            </div>
            {locationModal.loading ? (
              <div style={{ padding:40, display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                <div style={{ width:28, height:28, border:'2px solid #1e2530', borderTop:'2px solid #1e6fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                <span style={{ fontSize:12, color:'#4a5568' }}>Querying intelligence sources...</span>
              </div>
            ) : (
              <div style={{ padding:16, maxHeight:'70vh', overflowY:'auto' }}>
                {/* Address */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Location</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#e8edf2', lineHeight:1.4 }}>{locationModal.address}</div>
                  <div style={{ fontSize:11, color:'#4a5568', marginTop:4, fontFamily:'JetBrains Mono,monospace' }}>{locationModal.lngLat[1].toFixed(6)}, {locationModal.lngLat[0].toFixed(6)}</div>
                </div>

                {/* Info grid */}
                {Object.keys(locationModal.info).filter(k=>!['Google Maps','Satellite View','What3Words'].includes(k)).length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Site Data</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6 }}>
                      {Object.entries(locationModal.info).filter(([k])=>!['Google Maps','Satellite View','What3Words','Full Address','Coordinates'].includes(k)).map(([k,v]) => v ? (
                        <div key={k} style={{ background:'#111519', border:'1px solid #1e2530', borderRadius:2, padding:'8px 10px' }}>
                          <div style={{ fontSize:8, color:'#4a5568', letterSpacing:'0.08em', textTransform:'uppercase' }}>{k}</div>
                          <div style={{ fontSize:12, color:'#e8edf2', marginTop:2 }}>{v}</div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}

                {/* Links */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>View Location</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {['Google Maps','Satellite View','What3Words'].map(k => locationModal.info[k] ? (
                      <a key={k} href={locationModal.info[k]} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize:10, padding:'6px 10px', gap:4, textDecoration:'none' }}>
                        <ExternalLink size={10} />{k}
                      </a>
                    ) : null)}
                  </div>
                </div>

                {/* Ownership */}
                {Object.keys(locationModal.ownership).length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Ownership & Records</div>
                    {Object.entries(locationModal.ownership).map(([k,v]) => (
                      <div key={k} style={S.row}>
                        <span style={{ fontSize:11, color:'#4a5568', minWidth:120, flexShrink:0 }}>{k}</span>
                        {v.startsWith('http') ? (
                          <a href={v} target="_blank" rel="noreferrer" style={{ color:'#1e6fff', fontSize:12, flex:1 }}>Open</a>
                        ) : (
                          <span style={S.val}>{v}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* News */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Intelligence / News</div>
                  {locationModal.news.map((n,i) => (
                    <div key={i} style={{ background:'#111519', border:'1px solid #1e2530', borderRadius:2, padding:'10px 12px', marginBottom:6 }}>
                      <div style={{ fontSize:13, color:'#e8edf2', marginBottom:4, lineHeight:1.4 }}>{n.title}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'#1e6fff', fontWeight:600 }}>{n.source}</span>
                        <a href={n.url} target="_blank" rel="noreferrer" style={{ color:'#4a5568' }}><ExternalLink size={10} /></a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mark location */}
                <div>
                  <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Mark As Operational Site</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {LOCATION_TYPES.slice(0,4).map(lt => (
                      <button key={lt.id} onClick={() => {
                        setPendingMarker({ lngLat:locationModal.lngLat, type:lt.id, label:locationModal.address.split(',')[0]||'Site', notes:'' })
                        setLocationModal(null)
                      }} className="btn btn-ghost" style={{ fontSize:10, padding:'6px 10px', borderLeft:`2px solid ${lt.color}`, gap:4 }}>
                        <span style={{ color:lt.color }}>◆</span>{lt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
