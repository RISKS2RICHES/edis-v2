import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, AlertTriangle, Clock, Globe, Filter } from 'lucide-react';
import { WAR_ZONES } from '../lib/constants';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  published: string;
  category: string;
  region: string;
  summary: string;
}

const CONFLICT_FEEDS = [
  { name: 'Reuters World', url: 'https://feeds.reuters.com/reuters/worldNews', category: 'WORLD' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'WORLD' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'MIDDLE EAST' },
  { name: 'Kyiv Independent', url: 'https://kyivindependent.com/feed/', category: 'UKRAINE' },
  { name: 'ACLED', url: 'https://acleddata.com/feed/', category: 'CONFLICT' },
];

const REGIONS = ['ALL', 'EUROPE', 'MIDDLE EAST', 'AFRICA', 'ASIA', 'AMERICAS'];

// Realistic conflict news data (live would need CORS proxy)
const MOCK_NEWS: NewsItem[] = [
  {
    id: '1', title: 'Ukrainian forces repel Russian assault near Pokrovsk as frontline stabilises',
    source: 'Kyiv Independent', url: '#', published: new Date(Date.now() - 1200000).toISOString(),
    category: 'UKRAINE', region: 'EUROPE',
    summary: 'Ukrainian military command reports successful defensive operations east of Pokrovsk. Artillery exchanges continue along a 40km stretch of the frontline.',
  },
  {
    id: '2', title: 'IDF ground operations continue in northern Gaza amid ceasefire talks',
    source: 'Reuters', url: '#', published: new Date(Date.now() - 2400000).toISOString(),
    category: 'GAZA', region: 'MIDDLE EAST',
    summary: 'Israeli forces continue military operations in the northern Gaza Strip. Mediators from Qatar and Egypt are working to broker a new ceasefire agreement.',
  },
  {
    id: '3', title: 'RSF advances in Darfur; UN warns of mass atrocity risk',
    source: 'Al Jazeera', url: '#', published: new Date(Date.now() - 3600000).toISOString(),
    category: 'SUDAN', region: 'AFRICA',
    summary: 'Rapid Support Forces have seized additional territory in South Darfur. The UN Security Council held an emergency session regarding deteriorating humanitarian conditions.',
  },
  {
    id: '4', title: 'Myanmar resistance forces capture strategic town in Shan State',
    source: 'The Irrawaddy', url: '#', published: new Date(Date.now() - 5400000).toISOString(),
    category: 'MYANMAR', region: 'ASIA',
    summary: 'Three Brotherhood Alliance forces have taken control of a key logistics hub in northern Shan State, cutting a major supply route for the military junta.',
  },
  {
    id: '5', title: 'Houthi forces launch drone swarm targeting Red Sea commercial shipping',
    source: 'Bloomberg', url: '#', published: new Date(Date.now() - 7200000).toISOString(),
    category: 'YEMEN', region: 'MIDDLE EAST',
    summary: 'Ansarallah forces claimed responsibility for drone and missile attacks on three commercial vessels in the Red Sea. US Navy intercepted multiple drones.',
  },
  {
    id: '6', title: 'JNIM claims attack on Malian army convoy in Mopti region',
    source: 'ACLED', url: '#', published: new Date(Date.now() - 9000000).toISOString(),
    category: 'SAHEL', region: 'AFRICA',
    summary: 'Jama\'at Nusrat al-Islam wal-Muslimin has claimed responsibility for an IED attack targeting a Malian Armed Forces convoy, killing at least 8 soldiers.',
  },
  {
    id: '7', title: 'NATO activates rapid response elements amid Baltic tension escalation',
    source: 'Defense News', url: '#', published: new Date(Date.now() - 10800000).toISOString(),
    category: 'NATO', region: 'EUROPE',
    summary: 'NATO has placed additional rapid reaction forces on heightened readiness following incidents involving Russian military aircraft in Baltic airspace.',
  },
  {
    id: '8', title: 'Pakistani-Afghan border clashes leave dozens dead in Khyber Pakhtunkhwa',
    source: 'Dawn', url: '#', published: new Date(Date.now() - 12600000).toISOString(),
    category: 'PAKISTAN', region: 'ASIA',
    summary: 'Pakistani security forces engaged TTP militants in a series of firefights along the Afghan border. Operation continues with air support deployed.',
  },
  {
    id: '9', title: 'Ethiopia: Amhara conflict enters new phase as federal troops advance',
    source: 'Ethiopia Insight', url: '#', published: new Date(Date.now() - 14400000).toISOString(),
    category: 'ETHIOPIA', region: 'AFRICA',
    summary: 'Ethiopian National Defense Forces have launched a new offensive against Fano militias in the Amhara region. Telecommunications remain disrupted.',
  },
  {
    id: '10', title: 'Russia deploys additional S-400 batteries to Kaliningrad enclave',
    source: 'Jane\'s Defence', url: '#', published: new Date(Date.now() - 18000000).toISOString(),
    category: 'RUSSIA', region: 'EUROPE',
    summary: 'Satellite imagery analysis confirms deployment of additional air defence systems to Kaliningrad. NATO Baltic air policing mission has been augmented in response.',
  },
  {
    id: '11', title: 'Gaza humanitarian corridor reopens for limited aid convoys under pressure',
    source: 'UN OCHA', url: '#', published: new Date(Date.now() - 21600000).toISOString(),
    category: 'GAZA', region: 'MIDDLE EAST',
    summary: 'A limited number of aid trucks have entered northern Gaza via the Kerem Shalom crossing following international diplomatic pressure. WFP describes situation as catastrophic.',
  },
  {
    id: '12', title: 'Wagner successor Africa Corps expands footprint in Libya',
    source: 'Middle East Eye', url: '#', published: new Date(Date.now() - 25200000).toISOString(),
    category: 'LIBYA', region: 'AFRICA',
    summary: 'Russian paramilitary forces operating under the Africa Corps brand have reportedly established new forward operating positions in southwestern Libya.',
  },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function severityColor(category: string): string {
  const high = ['UKRAINE', 'GAZA', 'SUDAN', 'YEMEN', 'MYANMAR'];
  const med = ['SAHEL', 'NATO', 'RUSSIA', 'ETHIOPIA', 'LIBYA'];
  if (high.includes(category)) return '#ff3b3b';
  if (med.includes(category)) return '#ffb800';
  return '#8b97a8';
}

export default function ConflictsPage() {
  const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS);
  const [region, setRegion] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<typeof WAR_ZONES[0] | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const filteredNews = news.filter(n => {
    if (region !== 'ALL' && n.region !== region) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.summary.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setNews([...MOCK_NEWS].sort(() => Math.random() - 0.5));
      setLastUpdated(new Date());
      setLoading(false);
    }, 1200);
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 120000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Active conflicts */}
      <div style={{
        width: '260px', flexShrink: 0,
        background: '#0d1117', borderRight: '1px solid #1e2530',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }} className="hidden md:flex">
        <div className="intel-panel-header">
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff3b3b', animation: 'pulse-live 1.5s infinite' }} />
          Active Conflicts ({WAR_ZONES.length})
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {WAR_ZONES.map(z => (
            <button
              key={z.id}
              onClick={() => setSelectedConflict(selectedConflict?.id === z.id ? null : z)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px',
                background: selectedConflict?.id === z.id ? '#1e2530' : 'transparent',
                border: 'none', borderBottom: '1px solid #1e2530',
                cursor: 'pointer',
                borderLeft: selectedConflict?.id === z.id ? '2px solid #ff3b3b' : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#e8edf2' }}>{z.name}</span>
                <span style={{
                  fontSize: '8px', padding: '1px 5px', borderRadius: '2px',
                  background: z.severity === 'CRITICAL' ? '#3d0000' : z.severity === 'HIGH' ? '#2d1200' : '#1a1a00',
                  color: z.severity === 'CRITICAL' ? '#ff3b3b' : z.severity === 'HIGH' ? '#ff8c00' : '#ffb800',
                  border: `1px solid ${z.severity === 'CRITICAL' ? '#ff3b3b' : z.severity === 'HIGH' ? '#ff8c00' : '#ffb800'}`,
                  letterSpacing: '0.1em', fontWeight: '700',
                }}>
                  {z.severity}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#8b97a8' }}>Since {z.startDate}</div>
              <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '2px' }}>{z.casualties} est. casualties</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Conflict detail */}
        {selectedConflict && (
          <div style={{
            background: '#111519', borderBottom: '1px solid #1e2530',
            padding: '12px 16px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#ff3b3b', marginBottom: '6px' }}>
                  {selectedConflict.name}
                </div>
                <p style={{ fontSize: '12px', color: '#8b97a8', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                  {selectedConflict.summary}
                </p>
                <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: '2px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '9px', color: '#4a5568', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Latest Intelligence
                  </div>
                  <div style={{ fontSize: '12px', color: '#e8edf2' }}>{selectedConflict.latestUpdate}</div>
                </div>
              </div>
              <button onClick={() => setSelectedConflict(null)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '18px', flexShrink: 0 }}>×</button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          background: '#0d1117', borderBottom: '1px solid #1e2530',
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
            <Globe size={13} color="#4a5568" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conflicts & intelligence..."
              style={{ background: 'none !important', border: 'none !important', outline: 'none', color: '#e8edf2', fontSize: '12px', flex: 1, boxShadow: 'none !important' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                style={{
                  padding: '3px 8px', fontSize: '9px', letterSpacing: '0.08em',
                  background: region === r ? '#1e6fff' : '#1e2530',
                  border: `1px solid ${region === r ? '#1e6fff' : '#2d3748'}`,
                  color: region === r ? '#fff' : '#8b97a8',
                  borderRadius: '2px', cursor: 'pointer',
                  textTransform: 'uppercase', fontWeight: '600',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '9px', color: '#4a5568', fontFamily: 'JetBrains Mono, monospace' }}>
              {lastUpdated.toTimeString().substring(0, 8)}
            </span>
            <button
              onClick={refresh}
              style={{
                background: '#1e2530', border: '1px solid #2d3748', borderRadius: '2px',
                color: '#8b97a8', cursor: 'pointer', padding: '3px 8px',
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px',
              }}
            >
              <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* News feed */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            {filteredNews.map(item => (
              <div key={item.id} className="intel-panel" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '8px', padding: '1px 5px', borderRadius: '2px',
                        background: '#1e2530', color: severityColor(item.category),
                        border: `1px solid ${severityColor(item.category)}40`,
                        letterSpacing: '0.1em', fontWeight: '700', textTransform: 'uppercase',
                      }}>
                        {item.category}
                      </span>
                      <span style={{ fontSize: '9px', color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {item.region}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#e8edf2', lineHeight: '1.4', marginBottom: '6px' }}>
                      {item.title}
                    </div>
                    <p style={{ fontSize: '11px', color: '#8b97a8', lineHeight: '1.6', margin: 0 }}>
                      {item.summary}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #1e2530' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#1e6fff', fontWeight: '600' }}>{item.source}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={9} color="#4a5568" />
                      <span style={{ fontSize: '9px', color: '#4a5568', fontFamily: 'JetBrains Mono, monospace' }}>
                        {timeAgo(item.published)}
                      </span>
                    </div>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#4a5568', display: 'flex' }}>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))}
            {filteredNews.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568', fontSize: '12px' }}>
                No results found for current filters
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
