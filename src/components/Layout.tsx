import { useState, useEffect } from 'react'
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

  // Close mobile menu on page change
  useEffect(() => {
    setMobileOpen(false)
  }, [activePage])

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0c0f', overflow: 'hidden' }}>
      {/* Classification banner */}
      <div className="classification-bar">{CLASSIFICATION}</div>

      {/* Top bar */}
      <header style={{ 
        background: '#0d1117', 
        borderBottom: '1px solid #1e2530', 
        height: 48, 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 12px', 
        gap: 12, 
        flexShrink: 0, 
        zIndex: 50 
      }}>
        <button 
          className="hide-desktop" 
          onClick={() => setMobileOpen(v => !v)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: mobileOpen ? '#1e6fff' : '#8b97a8', 
            cursor: 'pointer', 
            padding: 8, 
            display: 'flex',
            borderRadius: 4,
          }}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color="#1e6fff" />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#e8edf2', letterSpacing: '0.06em' }}>E-DIS</span>
          <span className="hide-mobile" style={{ fontSize: 9, color: '#4a5568', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Global Private Intelligence</span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 10, color: '#00ff88', fontFamily: 'JetBrains Mono, monospace' }}>LIVE</span>
          </div>
          <span className="hide-mobile mono" style={{ fontSize: 10, color: '#4a5568' }}>{new Date().toISOString().substring(0,19).replace('T',' ')} UTC</span>
          <Activity size={14} color="#00ff88" className="hide-mobile" />
          <Bell size={16} color="#8b97a8" style={{ cursor: 'pointer' }} />
          <Settings size={16} color="#8b97a8" style={{ cursor: 'pointer' }} className="hide-mobile" />
          <div style={{ 
            width: 28, 
            height: 28, 
            borderRadius: '50%', 
            background: '#1e2530', 
            border: '1px solid #2d3748', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer' 
          }}>
            <User size={14} color="#8b97a8" />
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Mobile overlay */}
        <div 
          className={`slide-panel-overlay ${mobileOpen ? 'slide-panel-overlay-open' : ''}`}
          onClick={() => setMobileOpen(false)} 
        />

        {/* Mobile slide menu */}
        <nav 
          className={`slide-panel slide-panel-left ${mobileOpen ? 'slide-panel-open' : ''} hide-desktop`}
          style={{ width: 260, paddingTop: 8 }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2530', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Shield size={18} color="#1e6fff" />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: '#e8edf2' }}>E-DIS</span>
            </div>
            <span style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Navigation</span>
          </div>
          
          {NAV.map(n => {
            const Icon = n.icon
            const active = activePage === n.id
            return (
              <button 
                key={n.id} 
                onClick={() => { onNavigate(n.id); setMobileOpen(false) }} 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '14px 20px', 
                  width: '100%',
                  background: active ? '#1e2530' : 'transparent', 
                  border: 'none',
                  borderLeft: active ? '3px solid #1e6fff' : '3px solid transparent',
                  color: active ? '#e8edf2' : '#8b97a8', 
                  cursor: 'pointer',
                  fontSize: 13, 
                  fontWeight: active ? 600 : 400, 
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} />
                {n.label}
              </button>
            )
          })}

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', borderTop: '1px solid #1e2530', background: '#0a0c0f' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 10, color: '#00ff88', fontFamily: 'JetBrains Mono, monospace' }}>SYSTEM ACTIVE</span>
            </div>
            <span style={{ fontSize: 9, color: '#4a5568' }}>{new Date().toISOString().substring(0,19).replace('T',' ')} UTC</span>
          </div>
        </nav>

        {/* Desktop sidebar */}
        <nav className="hide-mobile" style={{
          width: expanded ? 200 : 48, 
          background: '#0d1117', 
          borderRight: '1px solid #1e2530',
          display: 'flex', 
          flexDirection: 'column', 
          transition: 'width 0.2s ease', 
          flexShrink: 0, 
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, paddingTop: 8 }}>
            {NAV.map(n => {
              const Icon = n.icon
              const active = activePage === n.id
              return (
                <button 
                  key={n.id} 
                  onClick={() => onNavigate(n.id)}
                  title={!expanded ? n.label : undefined}
                  style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: expanded ? '11px 16px' : '11px 14px', 
                    width: '100%',
                    background: active ? '#1e2530' : 'transparent', 
                    border: 'none',
                    borderLeft: active ? '2px solid #1e6fff' : '2px solid transparent',
                    color: active ? '#e8edf2' : '#4a5568', 
                    cursor: 'pointer',
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={18} style={{ flexShrink: 0 }} />
                  {expanded && <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, letterSpacing: '0.04em' }}>{n.label}</span>}
                </button>
              )
            })}
          </div>
          <button 
            onClick={() => setExpanded(v => !v)} 
            style={{
              padding: '12px 14px', 
              background: 'none', 
              border: 'none', 
              borderTop: '1px solid #1e2530',
              color: '#4a5568', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
            }}
          >
            {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            {expanded && <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Collapse</span>}
          </button>
        </nav>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="hide-desktop" style={{ 
        background: '#0d1117', 
        borderTop: '1px solid #1e2530', 
        display: 'flex', 
        height: 56, 
        flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {NAV.map(n => {
          const Icon = n.icon
          const active = activePage === n.id
          return (
            <button 
              key={n.id} 
              onClick={() => onNavigate(n.id)} 
              style={{
                flex: 1, 
                background: 'none', 
                border: 'none',
                borderTop: active ? '2px solid #1e6fff' : '2px solid transparent',
                color: active ? '#1e6fff' : '#4a5568', 
                cursor: 'pointer',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 3, 
                padding: '6px 2px',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={18} />
              <span style={{ fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{n.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
