import { useState, Suspense, lazy } from 'react'
import Layout from './components/Layout'

const MapPage = lazy(() => import('./pages/MapPage'))
const OperationsPage = lazy(() => import('./pages/OperationsPage'))
const ConflictsPage = lazy(() => import('./pages/ConflictsPage'))
const OsintPage = lazy(() => import('./pages/OsintPage'))
const PentestPage = lazy(() => import('./pages/PentestPage'))
const IntelligencePage = lazy(() => import('./pages/IntelligencePage'))

type Page = 'map' | 'conflicts' | 'osint' | 'operations' | 'pentest' | 'intelligence'

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12 }}>
      <div style={{ width:32, height:32, border:'2px solid #1e2530', borderTop:'2px solid #1e6fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ fontSize:10, color:'#4a5568', letterSpacing:'0.12em', textTransform:'uppercase' }}>Loading module</span>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('map')

  return (
    <Layout activePage={page} onNavigate={p => setPage(p as Page)}>
      <Suspense fallback={<Spinner />}>
        {page === 'map'          && <MapPage />}
        {page === 'conflicts'    && <ConflictsPage />}
        {page === 'osint'        && <OsintPage />}
        {page === 'operations'   && <OperationsPage />}
        {page === 'pentest'      && <PentestPage />}
        {page === 'intelligence' && <IntelligencePage />}
      </Suspense>
    </Layout>
  )
}
