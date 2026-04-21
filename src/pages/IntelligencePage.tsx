import { useState } from 'react';
import { Database, RefreshCw, ExternalLink, Shield, ChevronDown, ChevronUp, X } from 'lucide-react';
import { AGENCIES } from '../lib/constants';

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  country: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  USA: 'US', GBR: 'GB', EUR: 'EU', INT: 'UN',
};

const COUNTRY_COLORS: Record<string, string> = {
  USA: '#3c3b6e', GBR: '#012169', EUR: '#003399', INT: '#009EDB',
};

// Public RSS feeds that work via proxy
const PUBLIC_FEEDS = [
  { name: 'DHS Alerts', url: 'https://www.cisa.gov/uscert/ncas/alerts.xml', country: 'USA', agency: 'CISA' },
  { name: 'FBI Press', url: 'https://www.fbi.gov/feeds/fbi-top-stories/rss.xml', country: 'USA', agency: 'FBI' },
  { name: 'Europol News', url: 'https://www.europol.europa.eu/rss.xml', country: 'EUR', agency: 'Europol' },
  { name: 'IAEA News', url: 'https://www.iaea.org/feeds/subtopic/news.xml', country: 'INT', agency: 'IAEA' },
  { name: 'Reuters Security', url: 'https://feeds.reuters.com/reuters/worldNews', country: 'INT', agency: 'Reuters' },
  { name: 'Bellingcat', url: 'https://www.bellingcat.com/feed/', country: 'INT', agency: 'Bellingcat' },
  { name: 'The Record', url: 'https://therecord.media/feed', country: 'INT', agency: 'The Record' },
  { name: 'Threat Post', url: 'https://threatpost.com/feed/', country: 'INT', agency: 'Threatpost' },
];

// Mock intelligence items (real feeds would need CORS proxy)
const MOCK_INTEL: FeedItem[] = [
  { title: 'CISA Issues Emergency Directive on Critical Infrastructure Vulnerabilities', link: 'https://www.cisa.gov', pubDate: new Date(Date.now() - 900000).toISOString(), source: 'CISA', country: 'USA' },
  { title: 'FBI Disrupts International Cybercrime Network Operating from Eastern Europe', link: 'https://www.fbi.gov', pubDate: new Date(Date.now() - 2700000).toISOString(), source: 'FBI', country: 'USA' },
  { title: 'DEA Seizes $50M in Narcotics Linked to Transnational Criminal Organisation', link: 'https://www.dea.gov', pubDate: new Date(Date.now() - 5400000).toISOString(), source: 'DEA', country: 'USA' },
  { title: 'Europol Coordinates 12-Country Operation Targeting Human Trafficking Networks', link: 'https://www.europol.europa.eu', pubDate: new Date(Date.now() - 7200000).toISOString(), source: 'Europol', country: 'EUR' },
  { title: 'NCA Arrests 30 in UK-Wide Dark Web Drug Supply Takedown', link: 'https://nationalcrimeagency.gov.uk', pubDate: new Date(Date.now() - 9000000).toISOString(), source: 'NCA', country: 'GBR' },
  { title: 'IAEA Confirms Uranium Enrichment Activity at Fordow Facility in Iran', link: 'https://www.iaea.org', pubDate: new Date(Date.now() - 10800000).toISOString(), source: 'IAEA', country: 'INT' },
  { title: 'Bellingcat: Open Source Analysis Identifies Russian Missile Manufacturing Site', link: 'https://www.bellingcat.com', pubDate: new Date(Date.now() - 14400000).toISOString(), source: 'Bellingcat', country: 'INT' },
  { title: 'Interpol Red Notice Issued for Sanctioned Arms Dealer Operating in West Africa', link: 'https://www.interpol.int', pubDate: new Date(Date.now() - 18000000).toISOString(), source: 'Interpol', country: 'EUR' },
  { title: 'GCHQ Warns UK Businesses of Sustained State-Sponsored Espionage Campaign', link: 'https://www.ncsc.gov.uk', pubDate: new Date(Date.now() - 21600000).toISOString(), source: 'GCHQ/NCSC', country: 'GBR' },
  { title: 'NSA Issues Advisory on Vulnerabilities in Industrial Control Systems', link: 'https://www.nsa.gov', pubDate: new Date(Date.now() - 25200000).toISOString(), source: 'NSA', country: 'USA' },
  { title: 'DHS Raises Threat Level Following Credible Infrastructure Attack Intelligence', link: 'https://www.dhs.gov', pubDate: new Date(Date.now() - 28800000).toISOString(), source: 'DHS', country: 'USA' },
  { title: 'MI5 Annual Threat Report: China, Russia, Iran Named as Primary State Threats', link: 'https://www.mi5.gov.uk', pubDate: new Date(Date.now() - 36000000).toISOString(), source: 'MI5', country: 'GBR' },
  { title: 'Cyber Command Attributes Volt Typhoon Campaign to PLA Unit 61398', link: 'https://www.cybercom.mil', pubDate: new Date(Date.now() - 43200).toISOString(), source: 'US CyberCom', country: 'USA' },
  { title: 'UN Monitoring Group Reports Sanctions Violations by North Korean Front Companies', link: 'https://www.un.org', pubDate: new Date(Date.now() - 50400000).toISOString(), source: 'UN', country: 'INT' },
  { title: 'Counter Terrorism Policing: Prevent Programme Referrals Up 34% Year-on-Year', link: 'https://www.counterterrorism.police.uk', pubDate: new Date(Date.now() - 57600000).toISOString(), source: 'CTP', country: 'GBR' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IntelligencePage() {
  const [items, setItems] = useState<FeedItem[]>(MOCK_INTEL);
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAgencies, setExpandedAgencies] = useState<Record<string, boolean>>({ USA: true, GBR: true });
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const countries = ['ALL', 'USA', 'GBR', 'EUR', 'INT'];

  const filteredItems = items.filter(i => {
    if (selectedCountry !== 'ALL' && i.country !== selectedCountry) return false;
    if (selectedAgency && i.source !== selectedAgency) return false;
    return true;
  });

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setItems([...MOCK_INTEL].sort(() => Math.random() - 0.5).map(i => ({ ...i, pubDate: new Date(Date.now() - Math.random() * 86400000).toISOString() })));
      setLastUpdated(new Date());
      setLoading(false);
    }, 1500);
  };

  const agenciesByCountry = (country: string) => AGENCIES.filter(a => a.country === country);
  const toggleCountryExpand = (country: string) => setExpandedAgencies(p => ({ ...p, [country]: !p[country] }));

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: agency directory */}
      <div style={{
        width: '220px', flexShrink: 0,
        background: '#0d1117', borderRight: '1px solid #1e2530',
        overflow: 'auto',
      }} className="hidden md:block">
        <div className="intel-panel-header">
          <Shield size={12} color="#1e6fff" />
          Agency Directory
        </div>

        {['USA', 'GBR', 'EUR', 'INT'].map(country => (
          <div key={country}>
            <button
              onClick={() => toggleCountryExpand(country)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid #1e2530',
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#e8edf2', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {country}
              </span>
              {expandedAgencies[country] ? <ChevronUp size={10} color="#4a5568" /> : <ChevronDown size={10} color="#4a5568" />}
            </button>
            {expandedAgencies[country] && agenciesByCountry(country).map(agency => (
              <button
                key={agency.name}
                onClick={() => setSelectedAgency(selectedAgency === agency.name ? null : agency.name)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 12px 7px 20px',
                  background: selectedAgency === agency.name ? '#1e2530' : 'transparent',
                  border: 'none', borderBottom: '1px solid #1a1a1a',
                  cursor: 'pointer',
                  borderLeft: selectedAgency === agency.name ? '2px solid #1e6fff' : '2px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: selectedAgency === agency.name ? '#e8edf2' : '#8b97a8' }}>
                    {agency.name}
                  </span>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (agency as Record<string, unknown>).feed ? '#00ff88' : '#2d3748', flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: '9px', color: '#4a5568', lineHeight: '1.3', marginTop: '1px' }}>{agency.full}</div>
              </button>
            ))}
          </div>
        ))}

        <div style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88' }} />
            <span style={{ fontSize: '9px', color: '#4a5568' }}>Live feed available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d3748' }} />
            <span style={{ fontSize: '9px', color: '#4a5568' }}>Manual monitoring</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          background: '#0d1117', borderBottom: '1px solid #1e2530',
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap',
        }}>
          <Database size={13} color="#1e6fff" />
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e8edf2' }}>
            Intelligence Feed
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="live-dot" />
            <span style={{ fontSize: '9px', color: '#00ff88', fontFamily: 'JetBrains Mono, monospace' }}>LIVE</span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            {countries.map(c => (
              <button
                key={c}
                onClick={() => { setSelectedCountry(c); setSelectedAgency(null); }}
                style={{
                  padding: '3px 8px', fontSize: '9px',
                  background: selectedCountry === c ? '#1e6fff' : '#1e2530',
                  border: `1px solid ${selectedCountry === c ? '#1e6fff' : '#2d3748'}`,
                  color: selectedCountry === c ? '#fff' : '#8b97a8',
                  borderRadius: '2px', cursor: 'pointer',
                  fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >
                {c}
              </button>
            ))}
            <span style={{ fontSize: '9px', color: '#4a5568', fontFamily: 'JetBrains Mono, monospace' }}>
              {lastUpdated.toTimeString().substring(0, 8)}
            </span>
            <button
              onClick={refresh}
              style={{
                background: '#1e2530', border: '1px solid #2d3748', borderRadius: '2px',
                color: '#8b97a8', cursor: 'pointer', padding: '4px 8px',
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px',
              }}
            >
              <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Active filter indicator */}
        {(selectedAgency) && (
          <div style={{
            background: '#111519', borderBottom: '1px solid #1e2530',
            padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '10px', color: '#8b97a8' }}>Filtered:</span>
            <span style={{
              background: '#1e2530', color: '#1e6fff', border: '1px solid #2d3748',
              padding: '2px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '600',
              display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
            }} onClick={() => setSelectedAgency(null)}>
              {selectedAgency} <X size={9} />
            </span>
          </div>
        )}

        {/* Feed */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568', fontSize: '12px' }}>
              No intelligence items for current filter
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              {filteredItems.map((item, idx) => (
                <div key={idx} className="intel-panel" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '2px', flexShrink: 0,
                      background: COUNTRY_COLORS[item.country] || '#1e2530',
                      border: '1px solid #2d3748',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '9px', color: '#fff', fontWeight: '700', letterSpacing: '0.05em' }}>
                        {item.country}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '9px', padding: '1px 6px', borderRadius: '2px',
                          background: '#1e2530', color: '#1e6fff',
                          border: '1px solid #2d374840',
                          letterSpacing: '0.08em', fontWeight: '700', textTransform: 'uppercase',
                        }}>
                          {item.source}
                        </span>
                        <span style={{ fontSize: '9px', color: '#4a5568', fontFamily: 'JetBrains Mono, monospace' }}>
                          {timeAgo(item.pubDate)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#e8edf2', lineHeight: '1.4' }}>
                        {item.title}
                      </div>
                    </div>
                    <a href={item.link} target="_blank" rel="noreferrer" style={{ color: '#4a5568', flexShrink: 0 }}>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


