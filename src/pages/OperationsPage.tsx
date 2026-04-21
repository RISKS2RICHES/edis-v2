import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MAPBOX_TOKEN, LOCATION_TYPES } from '../lib/constants'
import { Search, X, Building, FileText, Route, Loader, ChevronDown, ChevronUp, MapPin, ExternalLink } from 'lucide-react'

mapboxgl.accessToken = MAPBOX_TOKEN

interface AddressResult {
  address: string
  coordinates: [number,number]
  info: Record<string,unknown>
  building: Record<string,unknown>
  ownership: Record<string,unknown>
}

async function geocode(q: string) {
  const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1`)
  const d = await r.json()
  return d.features?.[0] || null
}

async function lookupAddress(address: string): Promise<AddressResult | null> {
  const geo = await geocode(address)
  if (!geo) return null
  const [lng, lat] = geo.center
  const ctx = geo.context || []
  const country = ctx.find((c:any)=>c.id?.startsWith('country'))?.text || ''
  const postcode = ctx.find((c:any)=>c.id?.startsWith('postcode'))?.text || ''
  const city = ctx.find((c:any)=>c.id?.startsWith('place'))?.text || ''
  const region = ctx.find((c:any)=>c.id?.startsWith('region'))?.text || ''

  const info: Record<string,unknown> = {
    'Full Address': geo.place_name,
    'Coordinates': `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    Country: country, Region: region, City: city, Postcode: postcode,
    'Google Maps': `https://www.google.com/maps?q=${lat},${lng}`,
    'Satellite': `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e3`,
  }

  const building: Record<string,unknown> = {
    'OSM Data': 'Querying…',
    'Planning Portal': 'https://www.planningportal.co.uk/find-and-register-a-planning-application',
    'EPC Register': 'https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode',
    'Historic England': 'https://historicengland.org.uk/listing/the-list/',
    Note: 'Blueprints for private properties are not publicly available. Planning applications may contain floor plans for commercial developments.',
  }

  const ownership: Record<string,unknown> = {
    'Land Registry (UK)': `https://search-property-information.service.gov.uk/search/search-by-address?postcode=${encodeURIComponent(postcode)}`,
    '192.com': `https://www.192.com/places/${encodeURIComponent(address.split(',')[0])}`,
    'Companies House': `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(address)}`,
    Zoopla: `https://www.zoopla.co.uk/for-sale/details/search/?q=${encodeURIComponent(geo.place_name)}`,
  }

  // OSM building lookup
  try {
    const delta = 0.001
    const bbox = `${lat-delta},${lng-delta},${lat+delta},${lng+delta}`
    const q = `[out:json][timeout:8];(way["building"](${bbox});node["amenity"](${bbox}););out tags center;`
    const r = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body:`data=${encodeURIComponent(q)}` })
    const d = await r.json()
    const blds = (d.elements||[]).filter((e:any)=>e.tags?.building)
    if (blds.length > 0) {
      const b = blds[0]
      building['OSM Data'] = 'Found'
      building['Type'] = b.tags.building
      if (b.tags.name) building['Name'] = b.tags.name
      if (b.tags['building:levels']) building['Floors'] = b.tags['building:levels']
      if (b.tags.operator) ownership['Operator'] = b.tags.operator
    } else {
      building['OSM Data'] = 'No building record'
    }
  } catch { building['OSM Data'] = 'Query failed' }

  // Companies House
  if (postcode) {
    try {
      const r = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(postcode)}&items_per_page=5`)
      if (r.ok) {
        const d = await r.json()
        const items = (d.items||[]).slice(0,3)
        if (items.length) ownership['Registered Cos'] = items.map((c:any)=>c.title).join(', ')
      }
    } catch {}
  }

  return { address: geo.place_name, coordinates:[lng,lat], info, building, ownership }
}

export default function OperationsPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map|null>(null)
  const markerRef = useRef<mapboxgl.Marker|null>(null)

  const [addressInput, setAddressInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AddressResult|null>(null)
  const [error, setError] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [sections, setSections] = useState({loc:true,bld:false,own:false,route:false})
  const [waypoints, setWaypoints] = useState<{id:string;addr:string}[]>([{id:'a',addr:''},{id:'b',addr:''}])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeInfo, setRouteInfo] = useState<{dist:string;time:string}|null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0,20], zoom:2, pitch:45, antialias:true,
    })
    map.current.on('load', () => {
      const m = map.current!
      m.addSource('mapbox-dem', { type:'raster-dem', url:'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize:512, maxzoom:14 })
      m.setTerrain({ source:'mapbox-dem', exaggeration:1.5 })
      m.addLayer({
        id:'3d-buildings', source:'composite', 'source-layer':'building',
        filter:['==','extrude','true'], type:'fill-extrusion', minzoom:14,
        paint:{
          'fill-extrusion-color':'#1a2535',
          'fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,14.05,['get','height']],
          'fill-extrusion-base':['interpolate',['linear'],['zoom'],14,0,14.05,['get','min_height']],
          'fill-extrusion-opacity':0.9,
        }
      })
    })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
  }, [])

  const search = async () => {
    if (!addressInput.trim() || !map.current) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await lookupAddress(addressInput)
      if (!r) throw new Error('Address not found')
      setResult(r)
      map.current.flyTo({ center:r.coordinates, zoom:17, pitch:60, bearing:20, duration:2000 })
      if (markerRef.current) markerRef.current.remove()
      const el = document.createElement('div')
      el.style.cssText='width:22px;height:22px;border-radius:50%;background:#1e6fff33;border:2px solid #1e6fff;box-shadow:0 0 14px #1e6fff88;cursor:pointer;'
      markerRef.current = new mapboxgl.Marker({element:el})
        .setLngLat(r.coordinates)
        .setPopup(new mapboxgl.Popup({closeButton:false}).setHTML(`<div style="font-family:'IBM Plex Sans',system-ui;font-size:12px"><div style="color:#1e6fff;font-weight:700;margin-bottom:4px">LOCATION PINNED</div><div style="color:#e8edf2">${r.address}</div></div>`))
        .addTo(map.current!)
      markerRef.current.togglePopup()
    } catch(e) { setError(e instanceof Error ? e.message : 'Lookup failed') }
    finally { setLoading(false) }
  }

  const planRoute = async () => {
    if (!map.current) return
    const valid = waypoints.filter(w=>w.addr.trim())
    if (valid.length < 2) return
    setRouteLoading(true)
    try {
      const geocoded = await Promise.all(valid.map(async w => { const g = await geocode(w.addr); return g ? g.center as [number,number] : null }))
      const pts = geocoded.filter(Boolean) as [number,number][]
      if (pts.length < 2) throw new Error('Could not geocode waypoints')
      const coords = pts.map(p=>p.join(',')).join(';')
      const r = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}`)
      const d = await r.json()
      const route = d.routes?.[0]
      if (!route) throw new Error('No route found')
      const m = map.current
      if (m.getLayer('op-route')) m.removeLayer('op-route')
      if (m.getLayer('op-route-g')) m.removeLayer('op-route-g')
      if (m.getSource('op-route')) m.removeSource('op-route')
      m.addSource('op-route', { type:'geojson', data:{type:'Feature',properties:{},geometry:route.geometry} })
      m.addLayer({ id:'op-route-g', type:'line', source:'op-route', paint:{'line-color':'#1e6fff','line-width':8,'line-opacity':0.15} })
      m.addLayer({ id:'op-route', type:'line', source:'op-route', layout:{'line-join':'round','line-cap':'round'}, paint:{'line-color':'#1e6fff','line-width':2.5,'line-dasharray':[2,1]} })
      const dist = (route.distance/1000).toFixed(1)
      const mins = Math.round(route.duration/60)
      setRouteInfo({ dist:`${dist}km`, time:`${mins} min` })
      const allCoords = route.geometry.coordinates as [number,number][]
      const bounds = allCoords.reduce((b:mapboxgl.LngLatBounds,c:[number,number])=>b.extend(c), new mapboxgl.LngLatBounds(allCoords[0],allCoords[0]))
      m.fitBounds(bounds, { padding:60, duration:1500 })
    } catch(e) { setError(e instanceof Error ? e.message : 'Route failed') }
    finally { setRouteLoading(false) }
  }

  const hdr = { fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase' as const, display:'block', marginBottom:4 }
  const row = (k:string, v:unknown) => {
    if (!v || v==='') return null
    const s = typeof v === 'string' ? v : String(v)
    const isUrl = s.startsWith('http')
    return (
      <div key={k} style={{ display:'flex', gap:8, marginBottom:5, flexWrap:'wrap' }}>
        <span style={{ fontSize:10, color:'#4a5568', minWidth:110, flexShrink:0 }}>{k}</span>
        {isUrl ? <a href={s} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#1e6fff', flex:1 }}>Open ↗</a>
               : <span style={{ fontSize:11, color:'#e8edf2', flex:1, wordBreak:'break-word' }}>{s}</span>}
      </div>
    )
  }

  return (
    <div style={{ position:'relative', height:'100%', overflow:'hidden' }}>
      <div ref={mapContainer} style={{ width:'100%', height:'100%' }} />

      {/* Search */}
      <div style={{ position:'absolute', top:12, left:12, right: panelOpen ? 316 : 12, zIndex:10, background:'#0d1117', border:'1px solid #1e2530', borderRadius:2, display:'flex', alignItems:'center', gap:8, padding:'0 10px', maxWidth:500 }}>
        <Search size={13} color="#4a5568" style={{ flexShrink:0 }} />
        <input value={addressInput} onChange={e=>setAddressInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Search address, building, coordinates…" style={{ background:'none', border:'none', color:'#e8edf2', fontSize:12, flex:1, padding:'10px 0' }} />
        <button onClick={search} disabled={loading} className="btn btn-primary" style={{ padding:'5px 12px', fontSize:10, flexShrink:0 }}>
          {loading ? <Loader size={11} style={{ animation:'spin 0.8s linear infinite' }} /> : <Search size={11} />}
          <span className="hide-mobile">{loading?'…':'Locate'}</span>
        </button>
      </div>

      {/* Panel toggle */}
      <button onClick={()=>setPanelOpen(v=>!v)} style={{ position:'absolute', top:12, right: panelOpen?316:12, zIndex:10, background:'#0d1117', border:'1px solid #1e2530', borderRadius:2, color:'#8b97a8', cursor:'pointer', padding:'8px 10px', display:'flex', alignItems:'center', gap:5, fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase' }}>
        <FileText size={12} />
        <span className="hide-mobile">{panelOpen?'Hide':'Intel'}</span>
      </button>

      {/* Intel panel */}
      {panelOpen && (
        <div style={{ position:'absolute', top:0, right:0, bottom:0, width:300, background:'#0d1117', borderLeft:'1px solid #1e2530', zIndex:10, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ background:'#0a0c0f', borderBottom:'1px solid #1e2530', padding:'8px 12px', fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8b97a8', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <Building size={13} color="#1e6fff" /> Location Intelligence
            {result && <span style={{ marginLeft:'auto', color:'#00ff88' }}>FOUND</span>}
          </div>

          {error && <div style={{ padding:'8px 12px', background:'#1a0000', borderBottom:'1px solid #ff3b3b', fontSize:11, color:'#ff3b3b' }}>{error}</div>}
          {loading && <div style={{ padding:20, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Loader size={16} color="#1e6fff" style={{ animation:'spin 0.8s linear infinite' }} /><span style={{ fontSize:11, color:'#8b97a8' }}>Querying…</span></div>}

          <div style={{ flex:1, overflow:'auto' }}>
            {result ? (
              <>
                {/* Location */}
                <div style={{ borderBottom:'1px solid #1e2530' }}>
                  <button onClick={()=>setSections(p=>({...p,loc:!p.loc}))} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', color:'#8b97a8' }}>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Location</span>
                    {sections.loc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {sections.loc && <div style={{ padding:'0 12px 12px' }}>
                    {Object.entries(result.info).map(([k,v])=>row(k,v))}
                  </div>}
                </div>
                {/* Building */}
                <div style={{ borderBottom:'1px solid #1e2530' }}>
                  <button onClick={()=>setSections(p=>({...p,bld:!p.bld}))} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', color:'#8b97a8' }}>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Building Data</span>
                    {sections.bld ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {sections.bld && <div style={{ padding:'0 12px 12px' }}>
                    {Object.entries(result.building).map(([k,v])=>row(k,v))}
                  </div>}
                </div>
                {/* Ownership */}
                <div style={{ borderBottom:'1px solid #1e2530' }}>
                  <button onClick={()=>setSections(p=>({...p,own:!p.own}))} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', color:'#8b97a8' }}>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Ownership</span>
                    {sections.own ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {sections.own && <div style={{ padding:'0 12px 12px' }}>
                    {Object.entries(result.ownership).map(([k,v])=>row(k,v))}
                  </div>}
                </div>
                {/* Route */}
                <div style={{ borderBottom:'1px solid #1e2530' }}>
                  <button onClick={()=>setSections(p=>({...p,route:!p.route}))} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', color:'#8b97a8' }}>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Route Planning</span>
                    {sections.route ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {sections.route && (
                    <div style={{ padding:'0 12px 12px' }}>
                      {waypoints.map((wp,i) => (
                        <div key={wp.id} style={{ marginBottom:6, display:'flex', gap:5, alignItems:'center' }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', background:i===0?'#00ff88':i===waypoints.length-1?'#ff3b3b':'#1e6fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ fontSize:8, color:'#fff', fontWeight:700 }}>{i+1}</span>
                          </div>
                          <input value={wp.addr} onChange={e=>setWaypoints(wps=>wps.map(w=>w.id===wp.id?{...w,addr:e.target.value}:w))} placeholder={i===0?'Start':'Destination'} style={{ flex:1, padding:'5px 8px', fontSize:11 }} />
                          {waypoints.length>2 && <button onClick={()=>setWaypoints(wps=>wps.filter(w=>w.id!==wp.id))} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer' }}><X size={10} /></button>}
                        </div>
                      ))}
                      {routeInfo && (
                        <div style={{ background:'#111519', border:'1px solid #1e2530', borderRadius:2, padding:'6px 10px', marginBottom:8, display:'flex', gap:12 }}>
                          <div><div style={{ fontSize:9, color:'#4a5568', textTransform:'uppercase' }}>Distance</div><div style={{ fontSize:13, color:'#1e6fff', fontFamily:'JetBrains Mono,monospace', fontWeight:700 }}>{routeInfo.dist}</div></div>
                          <div><div style={{ fontSize:9, color:'#4a5568', textTransform:'uppercase' }}>Est. Time</div><div style={{ fontSize:13, color:'#e8edf2', fontFamily:'JetBrains Mono,monospace', fontWeight:700 }}>{routeInfo.time}</div></div>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>setWaypoints(wps=>[...wps.slice(0,-1),{id:Date.now().toString(),addr:''},wps[wps.length-1]])} className="btn btn-ghost" style={{ flex:1, justifyContent:'center', fontSize:10 }}>+ Waypoint</button>
                        <button onClick={planRoute} disabled={routeLoading} className="btn btn-primary" style={{ flex:1, justifyContent:'center', fontSize:10 }}>
                          {routeLoading ? <Loader size={10} style={{ animation:'spin 0.8s linear infinite' }} /> : <Route size={10} />}
                          Route
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {/* Mark */}
                <div style={{ padding:'8px 12px' }}>
                  <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Mark as Operational Site</div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {LOCATION_TYPES.slice(0,4).map(lt=>(
                      <button key={lt.id} className="btn btn-ghost" style={{ fontSize:9, padding:'4px 7px', borderLeft:`2px solid ${lt.color}`, gap:4 }}
                        onClick={()=>{
                          if (!map.current || !result) return
                          const el = document.createElement('div')
                          el.style.cssText=`width:24px;height:24px;border-radius:50%;background:${lt.color}22;border:2px solid ${lt.color};display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 8px ${lt.color}55;font-size:11px;`
                          new mapboxgl.Marker({element:el}).setLngLat(result.coordinates)
                            .setPopup(new mapboxgl.Popup({closeButton:false}).setHTML(`<div style="font-family:'IBM Plex Sans',system-ui;font-size:12px"><div style="color:${lt.color};font-weight:700;margin-bottom:4px">${lt.label}</div><div style="color:#e8edf2">${result.address}</div></div>`))
                            .addTo(map.current!)
                        }}>
                        <span style={{color:lt.color}}>◆</span>{lt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : !loading && (
              <div style={{ padding:'20px 16px' }}>
                <div style={{ background:'#111519', border:'1px solid #1e2530', borderRadius:2, padding:'10px 12px', marginBottom:12, display:'flex', gap:8 }}>
                  <MapPin size={14} color="#1e6fff" style={{ flexShrink:0, marginTop:1 }} />
                  <span style={{ fontSize:11, color:'#8b97a8', lineHeight:1.5 }}>Search any address to retrieve location intelligence, building data and ownership records.</span>
                </div>
                <div style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Capabilities</div>
                {['OSM building data','Companies House lookup','Land Registry links','Route planning','3D building view','Mark operational sites','Ownership records'].map(c=>(
                  <div key={c} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                    <div style={{ width:4, height:4, borderRadius:'50%', background:'#1e6fff', flexShrink:0 }} />
                    <span style={{ fontSize:11, color:'#8b97a8' }}>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
