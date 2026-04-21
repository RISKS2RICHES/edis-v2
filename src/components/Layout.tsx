import { useState } from 'react'
import { Map, Crosshair, Search, Target, Terminal, Database, ChevronLeft, ChevronRight, Bell, Settings, User, Activity, Shield, Menu, X } from 'lucide-react'
import { CLASSIFICATION } from '../lib/constants'

const NAV = [
  { id: 'map',          label: 'Live Map',          icon: Map },
  { id: 'conflicts',    label: 'Conflict Tracker',  icon: Crosshair },
  { id: 'osint',        label: 'OSINT Suite',        icon: Search },
  { id: 'operations',  label: 'Operations',         icon: Target },
  { id: 'pentest',      label: 'Pentest Tools',      icon: Terminal },
  { id: 'intelligence', label: 'Intelligence Feed',  icon: Database },
]

interface Props { activePage: string; onNavigate: (p: string) => void; children: React.ReactNode }

export default function Layout({ activePage, onNavigate, children }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const s: React.CSSProperties = { display:'flex', flexDirection:'column', height:'100vh', background:'#0a0c0f', overflow:'hidden' }

  return (
    <div style={s}>
      {/* Classification banner */}
      <div className="classification-bar">{CLASSIFICATION}</div>

      {/* Top bar */}
      <div style={{ background:'#0d1117', borderBottom:'1px solid #1e2530', height:40, display:'flex', alignItems:'center', padding:'0 12px', gap:12, flexShrink:0, zIndex:50 }}>
        <button className="hide-desktop" onClick={() => setMobileOpen(v => !v)}
          style={{ background:'none', border:'none', color:'#8b97a8', cursor:'pointer', padding:4, display:'flex' }}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Shield size={15} color="#1e6fff" />
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700, color:'#e8edf2', letterSpacing:'0.06em' }}>E-DIS</span>
          <span className="hide-mobile" style={{ fontSize:9, color:'#4a5568', letterSpacing:'0.1em', textTransform:'uppercase' }}>Global Private Intelligence</span>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div className="live-dot" />
            <span style={{ fontSize:10, color:'#00ff88', fontFamily:'JetBrains Mono,monospace' }}>LIVE</span>
          </div>
          <span className="hide-mobile mono" style={{ fontSize:10, color:'#4a5568' }}>{new Date().toISOString().substring(0,19).replace('T',' ')} UTC</span>
          <Activity size={13} color="#00ff88" />
          <Bell size={14} color="#8b97a8" style={{ cursor:'pointer' }} />
          <Settings size={14} color="#8b97a8" style={{ cursor:'pointer' }} />
          <div style={{ width:26, height:26, borderRadius:'50%', background:'#1e2530', border:'1px solid #2d3748', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <User size={12} color="#8b97a8" />
          </div>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>
        {/* Mobile overlay */}
        {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.7)' }} />}

        {/* Mobile slide menu */}
        <div className="hide-desktop" style={{
          position:'fixed', top:0, left:0, bottom:0, width:240,
          background:'#0d1117', borderRight:'1px solid #1e2530', zIndex:300,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:'transform 0.18s ease', paddingTop:56,
        }}>
          <div style={{ padding:'6px 12px 10px', fontSize:9, color:'#4a5568', letterSpacing:'0.12em', textTransform:'uppercase' }}>Navigation</div>
          {NAV.map(n => {
            const Icon = n.icon; const active = activePage === n.id
            return (
              <button key={n.id} onClick={() => { onNavigate(n.id); setMobileOpen(false) }} style={{
                display:'flex', alignItems:'center', gap:10, padding:'11px 16px', width:'100%',
                background: active ? '#1e2530' : 'transparent', border:'none',
                borderLeft: active ? '2px solid #1e6fff' : '2px solid transparent',
                color: active ? '#e8edf2' : '#8b97a8', cursor:'pointer',
                fontSize:12, fontWeight: active ? 600 : 400, textAlign:'left',
              }}>
                <Icon size={15} />{n.label}
              </button>
            )
          })}
        </div>

        {/* Desktop sidebar */}
        <div className="hide-mobile" style={{
          width: expanded ? 192 : 44, background:'#0d1117', borderRight:'1px solid #1e2530',
          display:'flex', flexDirection:'column', transition:'width 0.15s ease', flexShrink:0, overflow:'hidden',
        }}>
          <div style={{ flex:1, paddingTop:6 }}>
            {NAV.map(n => {
              const Icon = n.icon; const active = activePage === n.id
              return (
                <button key={n.id} onClick={() => onNavigate(n.id)}
                  title={!expanded ? n.label : undefined}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 14px', width:'100%',
                    background: active ? '#1e2530' : 'transparent', border:'none',
                    borderLeft: active ? '2px solid #1e6fff' : '2px solid transparent',
                    color: active ? '#e8edf2' : '#4a5568', cursor:'pointer',
                    whiteSpace:'nowrap', overflow:'hidden', transition:'all 0.1s',
                  }}>
                  <Icon size={16} style={{ flexShrink:0 }} />
                  {expanded && <span style={{ fontSize:11, fontWeight: active ? 600 : 400, letterSpacing:'0.04em' }}>{n.label}</span>}
                </button>
              )
            })}
          </div>
          <button onClick={() => setExpanded(v => !v)} style={{
            padding:'10px 14px', background:'none', border:'none', borderTop:'1px solid #1e2530',
            color:'#4a5568', cursor:'pointer', display:'flex', alignItems:'center', gap:8,
          }}>
            {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            {expanded && <span style={{ fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase' }}>Collapse</span>}
          </button>
        </div>

        {/* Page content */}
        <div style={{ flex:1, overflow:'hidden', position:'relative' }}>{children}</div>
      </div>

      {/* Mobile bottom nav */}
      <div className="hide-desktop" style={{ background:'#0d1117', borderTop:'1px solid #1e2530', display:'flex', height:52, flexShrink:0 }}>
        {NAV.map(n => {
          const Icon = n.icon; const active = activePage === n.id
          return (
            <button key={n.id} onClick={() => onNavigate(n.id)} style={{
              flex:1, background:'none', border:'none',
              borderTop: active ? '2px solid #1e6fff' : '2px solid transparent',
              color: active ? '#1e6fff' : '#4a5568', cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'4px 2px',
            }}>
              <Icon size={16} />
              <span style={{ fontSize:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>{n.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
