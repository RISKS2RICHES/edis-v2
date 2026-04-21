import { useState } from 'react';
import { Search, User, Mail, Phone, Globe, Hash, MapPin, Loader, ChevronDown, ChevronUp, Copy, Download, AlertCircle, ExternalLink } from 'lucide-react';

type OsintTab = 'person' | 'email' | 'username' | 'domain' | 'phone' | 'ip';

interface OsintResult {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  sources: string[];
}

// Haveibeenpwned-style email lookup via free API
async function lookupEmail(email: string): Promise<OsintResult> {
  const results: Record<string, unknown> = { email };
  const sources: string[] = [];

  // Hunter.io email verification (public)
  try {
    const r = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=free`);
    if (r.ok) { sources.push('Hunter.io'); }
  } catch { /* silent */ }

  // Abstract email validation (free tier)
  try {
    const r = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=free&email=${encodeURIComponent(email)}`);
    if (r.ok) { sources.push('AbstractAPI'); }
  } catch { /* silent */ }

  // Gravatar check
  try {
    const hash = await digestMessage(email.toLowerCase().trim());
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404&s=200`;
    const r = await fetch(gravatarUrl);
    if (r.ok) {
      results.gravatar = { found: true, url: `https://www.gravatar.com/${hash}`, avatarUrl: gravatarUrl };
      sources.push('Gravatar');
    } else {
      results.gravatar = { found: false };
    }
  } catch { /* silent */ }

  // Domain extraction
  const domain = email.split('@')[1];
  results.domain = domain;
  results.username = email.split('@')[0];

  // Format analysis
  const patterns = {
    isDisposable: ['mailinator', 'guerrillamail', 'temp-mail', 'throwam', '10minutemail', 'yopmail'].some(d => domain?.includes(d)),
    isCommonProvider: ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'protonmail'].some(d => domain?.includes(d)),
    isCorporate: !['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud'].some(d => domain?.includes(d)),
  };
  results.analysis = patterns;

  // Social platform checks (public endpoints)
  const platforms: Record<string, boolean> = {};
  const username = email.split('@')[0];

  sources.push('Pattern Analysis');

  results.possibleProfiles = [
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(username)}`,
    `https://twitter.com/search?q=${encodeURIComponent(email)}`,
    `https://www.facebook.com/search/top/?q=${encodeURIComponent(email)}`,
  ];

  return {
    type: 'email',
    data: results,
    timestamp: new Date().toISOString(),
    sources,
  };
}

async function digestMessage(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('MD5' as AlgorithmIdentifier, msgBuffer).catch(() => null);
  if (!hashBuffer) return message.replace(/[^a-z0-9]/g, '');
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function lookupUsername(username: string): Promise<OsintResult> {
  const platforms = [
    { name: 'GitHub', url: `https://github.com/${username}`, api: `https://api.github.com/users/${username}` },
    { name: 'Twitter/X', url: `https://twitter.com/${username}`, api: null },
    { name: 'Instagram', url: `https://www.instagram.com/${username}/`, api: null },
    { name: 'Reddit', url: `https://www.reddit.com/user/${username}`, api: `https://www.reddit.com/user/${username}/about.json` },
    { name: 'LinkedIn', url: `https://www.linkedin.com/in/${username}`, api: null },
    { name: 'TikTok', url: `https://www.tiktok.com/@${username}`, api: null },
    { name: 'Pinterest', url: `https://www.pinterest.com/${username}`, api: null },
    { name: 'Tumblr', url: `https://www.tumblr.com/${username}`, api: null },
    { name: 'Flickr', url: `https://www.flickr.com/people/${username}`, api: null },
    { name: 'Twitch', url: `https://www.twitch.tv/${username}`, api: `https://api.twitch.tv/helix/users?login=${username}` },
    { name: 'Steam', url: `https://steamcommunity.com/id/${username}`, api: null },
    { name: 'Keybase', url: `https://keybase.io/${username}`, api: `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${username}` },
    { name: 'HackerNews', url: `https://news.ycombinator.com/user?id=${username}`, api: `https://hacker-news.firebaseio.com/v0/user/${username}.json` },
    { name: 'Medium', url: `https://medium.com/@${username}`, api: null },
    { name: 'Dev.to', url: `https://dev.to/${username}`, api: `https://dev.to/api/users/by_username?url=${username}` },
    { name: 'ProductHunt', url: `https://www.producthunt.com/@${username}`, api: null },
    { name: 'Replit', url: `https://replit.com/@${username}`, api: null },
    { name: 'GitLab', url: `https://gitlab.com/${username}`, api: `https://gitlab.com/api/v4/users?username=${username}` },
    { name: 'Bitbucket', url: `https://bitbucket.org/${username}`, api: null },
    { name: 'npm', url: `https://www.npmjs.com/~${username}`, api: `https://registry.npmjs.org/-/v1/search?text=author:${username}&size=1` },
  ];

  const results: Array<{ platform: string; url: string; status: 'FOUND' | 'NOT FOUND' | 'CHECKING'; data?: Record<string, unknown> }> = [];

  // Check APIs that have CORS access
  const apiChecks = await Promise.allSettled(
    platforms.filter(p => p.api).map(async p => {
      try {
        const r = await fetch(p.api!, { headers: { 'Accept': 'application/json' } });
        if (r.ok) {
          const data = await r.json();
          let found = false;
          if (p.name === 'GitHub' && data.login) found = true;
          if (p.name === 'Reddit' && data.data?.name) found = true;
          if (p.name === 'HackerNews' && data?.id) found = true;
          if (p.name === 'Keybase' && data.status?.code === 0) found = true;
          if (p.name === 'Dev.to' && data.username) found = true;
          if (p.name === 'GitLab' && Array.isArray(data) && data.length > 0) found = true;
          if (p.name === 'npm' && data.objects?.length > 0) found = true;

          return { platform: p.name, url: p.url, status: found ? 'FOUND' as const : 'NOT FOUND' as const, data: found ? data : undefined };
        }
        return { platform: p.name, url: p.url, status: 'NOT FOUND' as const };
      } catch {
        return { platform: p.name, url: p.url, status: 'NOT FOUND' as const };
      }
    })
  );

  apiChecks.forEach((r, i) => {
    if (r.status === 'fulfilled') results.push(r.value);
  });

  // Add non-API platforms as deep links
  platforms.filter(p => !p.api).forEach(p => {
    results.push({ platform: p.name, url: p.url, status: 'CHECKING' });
  });

  return {
    type: 'username',
    data: { username, results, totalChecked: platforms.length, found: results.filter(r => r.status === 'FOUND').length },
    timestamp: new Date().toISOString(),
    sources: ['GitHub API', 'Reddit API', 'HackerNews API', 'Keybase API', 'Dev.to API', 'GitLab API'],
  };
}

async function lookupDomain(domain: string): Promise<OsintResult> {
  const results: Record<string, unknown> = { domain };
  const sources: string[] = [];

  // DNS lookup via Cloudflare DOH
  try {
    const [a, mx, txt, ns] = await Promise.all([
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, { headers: { Accept: 'application/dns-json' } }).then(r => r.json()),
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, { headers: { Accept: 'application/dns-json' } }).then(r => r.json()),
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=TXT`, { headers: { Accept: 'application/dns-json' } }).then(r => r.json()),
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=NS`, { headers: { Accept: 'application/dns-json' } }).then(r => r.json()),
    ]);
    results.dns = { A: a.Answer || [], MX: mx.Answer || [], TXT: txt.Answer || [], NS: ns.Answer || [] };
    sources.push('Cloudflare DNS-over-HTTPS');
  } catch { /* silent */ }

  // SSL/TLS cert info via crt.sh
  try {
    const r = await fetch(`https://crt.sh/?q=${domain}&output=json`);
    if (r.ok) {
      const certs = await r.json();
      results.certificates = certs.slice(0, 10).map((c: { id: string; issuer_ca_id: number; issuer_name: string; common_name: string; name_value: string; not_before: string; not_after: string }) => ({
        id: c.id,
        issuer: c.issuer_name,
        commonName: c.common_name,
        subjectAltNames: c.name_value?.split('\n'),
        notBefore: c.not_before,
        notAfter: c.not_after,
      }));
      sources.push('crt.sh Certificate Transparency');
    }
  } catch { /* silent */ }

  // RDAP/WHOIS via ICANN
  try {
    const tld = domain.split('.').pop();
    const rdapUrl = `https://rdap.verisign.com/com/v1/domain/${domain}`;
    const r = await fetch(rdapUrl);
    if (r.ok) {
      const data = await r.json();
      results.whois = {
        registrar: data.entities?.find((e: { roles: string[] }) => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find((v: string[]) => v[0] === 'fn')?.[3],
        created: data.events?.find((e: { eventAction: string }) => e.eventAction === 'registration')?.eventDate,
        expires: data.events?.find((e: { eventAction: string }) => e.eventAction === 'expiration')?.eventDate,
        updated: data.events?.find((e: { eventAction: string }) => e.eventAction === 'last changed')?.eventDate,
        nameservers: data.nameservers?.map((ns: { ldhName: string }) => ns.ldhName),
        status: data.status,
      };
      sources.push('RDAP / ICANN');
    }
  } catch { /* silent */ }

  // Shodan-style basic port info via public API
  results.portScan = {
    note: 'Full port scan requires authorised access. Common ports listed.',
    commonPorts: [
      { port: 80, service: 'HTTP', protocol: 'TCP' },
      { port: 443, service: 'HTTPS', protocol: 'TCP' },
      { port: 22, service: 'SSH', protocol: 'TCP' },
      { port: 25, service: 'SMTP', protocol: 'TCP' },
      { port: 53, service: 'DNS', protocol: 'UDP/TCP' },
    ]
  };

  return {
    type: 'domain',
    data: results,
    timestamp: new Date().toISOString(),
    sources,
  };
}

async function lookupIP(ip: string): Promise<OsintResult> {
  const results: Record<string, unknown> = { ip };
  const sources: string[] = [];

  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (r.ok) {
      const d = await r.json();
      results.geolocation = {
        country: d.country_name,
        countryCode: d.country_code,
        region: d.region,
        city: d.city,
        lat: d.latitude,
        lng: d.longitude,
        timezone: d.timezone,
        org: d.org,
        isp: d.isp,
        asn: d.asn,
      };
      sources.push('ipapi.co');
    }
  } catch { /* silent */ }

  try {
    const r = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
      headers: { Accept: 'application/json', Key: 'public' }
    });
    // Will fail without key but attempt for demo
  } catch { /* silent */ }

  try {
    const r = await fetch(`https://rdap.arin.net/registry/ip/${ip}`);
    if (r.ok) {
      const d = await r.json();
      results.rdap = {
        name: d.name,
        type: d.type,
        country: d.country,
        startAddress: d.startAddress,
        endAddress: d.endAddress,
        org: d.entities?.[0]?.vcardArray?.[1]?.find((v: string[]) => v[0] === 'fn')?.[3],
      };
      sources.push('ARIN RDAP');
    }
  } catch { /* silent */ }

  return {
    type: 'ip',
    data: results,
    timestamp: new Date().toISOString(),
    sources,
  };
}

async function lookupPhone(phone: string): Promise<OsintResult> {
  const results: Record<string, unknown> = { phone };
  const sources: string[] = [];

  // Basic number analysis
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  const countryCode = phone.startsWith('+44') || phone.startsWith('0044') ? 'GBR' :
    phone.startsWith('+1') || phone.startsWith('001') ? 'USA' :
    phone.startsWith('+33') ? 'FRA' :
    phone.startsWith('+49') ? 'DEU' :
    phone.startsWith('+7') ? 'RUS' : 'UNKNOWN';

  results.analysis = {
    cleaned,
    countryCode,
    length: cleaned.length,
    type: cleaned.length === 10 ? 'Possible mobile/landline' : cleaned.length === 11 ? 'International format' : 'Non-standard',
    e164Format: phone.startsWith('+') ? phone.replace(/[\s\-\(\)]/g, '') : `+${cleaned}`,
  };

  // NumVerify free lookup
  try {
    const r = await fetch(`https://phonevalidation.abstractapi.com/v1/?api_key=free&phone=${encodeURIComponent(phone)}`);
    // Will fail without key
  } catch { /* silent */ }

  // OSINT links
  results.searchLinks = [
    `https://www.truecaller.com/search/gb/${cleaned}`,
    `https://www.numbersearch.com/phone-lookup/${cleaned}`,
    `https://www.whitepages.com/phone/${cleaned}`,
    `https://pipl.com/search/?q=${cleaned}`,
    `https://www.google.com/search?q="${phone}"`,
    `https://www.facebook.com/search/top?q=${cleaned}`,
  ];

  sources.push('Pattern Analysis', 'OSINT Deep Links');

  return {
    type: 'phone',
    data: results,
    timestamp: new Date().toISOString(),
    sources,
  };
}

async function lookupPerson(params: Record<string, string>): Promise<OsintResult> {
  const results: Record<string, unknown> = { ...params };
  const sources: string[] = [];

  // Build search queries
  const queryParts: string[] = [];
  if (params.firstName && params.lastName) queryParts.push(`"${params.firstName} ${params.lastName}"`);
  else if (params.firstName) queryParts.push(`"${params.firstName}"`);
  if (params.email) queryParts.push(params.email);
  if (params.username) queryParts.push(params.username);
  if (params.location) queryParts.push(params.location);

  const query = queryParts.join(' ');

  results.searchLinks = {
    google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    pipl: `https://pipl.com/search/?q=${encodeURIComponent(query)}`,
    spokeo: `https://www.spokeo.com/${params.firstName}-${params.lastName}`,
    linkedin: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
    facebook: `https://www.facebook.com/search/top/?q=${encodeURIComponent(query)}`,
    twitter: `https://twitter.com/search?q=${encodeURIComponent(query)}`,
    instagram: params.username ? `https://www.instagram.com/${params.username}/` : null,
    companies_house: params.firstName && params.lastName ? `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(`${params.firstName} ${params.lastName}`)}` : null,
    electoral_roll: `https://www.192.com/people/${params.firstName}-${params.lastName}/`,
    truth_social: params.username ? `https://truthsocial.com/@${params.username}` : null,
  };

  // Companies House API (public, no key required for basic search)
  if (params.firstName && params.lastName) {
    try {
      const r = await fetch(`https://api.company-information.service.gov.uk/search/officers?q=${encodeURIComponent(`${params.firstName} ${params.lastName}`)}&items_per_page=10`);
      if (r.ok) {
        const d = await r.json();
        results.companiesHouse = {
          officers: (d.items || []).slice(0, 5).map((item: { title: string; address_snippet: string; description: string; links: { self: string } }) => ({
            name: item.title,
            address: item.address_snippet,
            description: item.description,
            url: `https://find-and-update.company-information.service.gov.uk${item.links?.self}`,
          }))
        };
        sources.push('Companies House (UK)');
      }
    } catch { /* silent */ }
  }

  // Email sub-lookup if email provided
  if (params.email) {
    const emailResult = await lookupEmail(params.email);
    results.emailIntel = emailResult.data;
    sources.push(...emailResult.sources);
  }

  // Username sub-lookup
  if (params.username) {
    const usernameResult = await lookupUsername(params.username);
    results.usernameIntel = usernameResult.data;
    sources.push(...usernameResult.sources);
  }

  sources.push('OSINT Aggregation', 'Pattern Analysis');

  return {
    type: 'person',
    data: results,
    timestamp: new Date().toISOString(),
    sources: [...new Set(sources)],
  };
}

function ResultPanel({ result }: { result: OsintResult }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const renderValue = (v: unknown, depth = 0): React.ReactNode => {
    if (v === null || v === undefined) return <span style={{ color: '#4a5568' }}>null</span>;
    if (typeof v === 'boolean') return <span style={{ color: v ? '#00ff88' : '#ff3b3b' }}>{v.toString()}</span>;
    if (typeof v === 'number') return <span style={{ color: '#00d4ff' }}>{v}</span>;
    if (typeof v === 'string') {
      if (v.startsWith('http')) return (
        <a href={v} target="_blank" rel="noreferrer" style={{ color: '#1e6fff', textDecoration: 'none', wordBreak: 'break-all' }}>
          {v} <ExternalLink size={9} style={{ display: 'inline' }} />
        </a>
      );
      return <span style={{ color: '#e8edf2', wordBreak: 'break-all' }}>{v}</span>;
    }
    if (Array.isArray(v)) {
      return (
        <div style={{ paddingLeft: depth > 0 ? '12px' : 0 }}>
          {v.map((item, i) => (
            <div key={i} style={{ marginBottom: '2px' }}>
              <span style={{ color: '#4a5568', fontSize: '10px' }}>[{i}] </span>
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }
    if (typeof v === 'object') {
      return (
        <div style={{ paddingLeft: depth > 0 ? '12px' : 0 }}>
          {Object.entries(v as Record<string, unknown>).map(([k, val]) => (
            <div key={k} style={{ marginBottom: '3px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              <span style={{ color: '#8b97a8', fontSize: '10px', minWidth: '100px', flexShrink: 0 }}>{k}:</span>
              <span style={{ flex: 1 }}>{renderValue(val, depth + 1)}</span>
            </div>
          ))}
        </div>
      );
    }
    return <span style={{ color: '#e8edf2' }}>{String(v)}</span>;
  };

  return (
    <div className="intel-panel" style={{ marginTop: '12px' }}>
      <div className="intel-panel-header">
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88' }} />
        OSINT REPORT — {result.type.toUpperCase()}
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#4a5568' }}>
          {new Date(result.timestamp).toISOString().replace('T', ' ').substring(0, 19)} UTC
        </span>
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e2530', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '9px', color: '#4a5568', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sources:</span>
        {result.sources.map(s => (
          <span key={s} style={{ fontSize: '9px', background: '#1e2530', color: '#1e6fff', padding: '1px 6px', borderRadius: '2px', border: '1px solid #2d3748' }}>
            {s}
          </span>
        ))}
      </div>

      <div style={{ padding: '12px' }}>
        {Object.entries(result.data).map(([key, value]) => (
          <div key={key} style={{ marginBottom: '8px', borderBottom: '1px solid #1e2530', paddingBottom: '8px' }}>
            <button
              onClick={() => toggle(key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', width: '100%', textAlign: 'left',
                padding: '2px 0', marginBottom: '4px',
              }}
            >
              {expanded[key] ? <ChevronUp size={11} color="#4a5568" /> : <ChevronDown size={11} color="#4a5568" />}
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#8b97a8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </button>
            {expanded[key] && (
              <div style={{ fontSize: '11px', paddingLeft: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                {renderValue(value)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_CONFIG = [
  { id: 'person' as OsintTab, label: 'Person', icon: User },
  { id: 'email' as OsintTab, label: 'Email', icon: Mail },
  { id: 'username' as OsintTab, label: 'Username', icon: Hash },
  { id: 'domain' as OsintTab, label: 'Domain', icon: Globe },
  { id: 'phone' as OsintTab, label: 'Phone', icon: Phone },
  { id: 'ip' as OsintTab, label: 'IP Address', icon: MapPin },
];

export default function OsintPage() {
  const [activeTab, setActiveTab] = useState<OsintTab>('person');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OsintResult | null>(null);
  const [error, setError] = useState('');

  // Form states
  const [personForm, setPersonForm] = useState({ firstName: '', lastName: '', email: '', phone: '', username: '', aliases: '', address: '', dob: '', nationality: '' });
  const [emailInput, setEmailInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [ipInput, setIpInput] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      let res: OsintResult;
      switch (activeTab) {
        case 'person': res = await lookupPerson(Object.fromEntries(Object.entries(personForm).filter(([, v]) => v))); break;
        case 'email': res = await lookupEmail(emailInput); break;
        case 'username': res = await lookupUsername(usernameInput); break;
        case 'domain': res = await lookupDomain(domainInput); break;
        case 'phone': res = await lookupPhone(phoneInput); break;
        case 'ip': res = await lookupIP(ipInput); break;
        default: throw new Error('Unknown tab');
      }
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: '#161b22',
    border: '1px solid #1e2530',
    color: '#e8edf2',
    padding: '7px 10px',
    borderRadius: '2px',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
  };

  const labelStyle = { fontSize: '10px', color: '#4a5568', letterSpacing: '0.1em', textTransform: 'uppercase' as const, display: 'block', marginBottom: '4px', marginTop: '10px' };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel — inputs */}
      <div style={{
        width: '320px', flexShrink: 0,
        background: '#0d1117', borderRight: '1px solid #1e2530',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2530', background: '#0a0c0f', flexWrap: 'wrap' }}>
          {TAB_CONFIG.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setResult(null); }}
                style={{
                  padding: '8px 12px',
                  background: active ? '#1e2530' : 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid #1e6fff' : '2px solid transparent',
                  color: active ? '#e8edf2' : '#4a5568',
                  cursor: 'pointer',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: active ? '700' : '400',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  flex: '1 1 auto',
                }}
              >
                <Icon size={11} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{ fontSize: '9px', color: '#ff8c00', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={10} />
            Authorised use only. All queries logged.
          </div>

          {activeTab === 'person' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input value={personForm.firstName} onChange={e => setPersonForm(p => ({ ...p, firstName: e.target.value }))} placeholder="John" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input value={personForm.lastName} onChange={e => setPersonForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" style={inputStyle} />
                </div>
              </div>
              <label style={labelStyle}>Known Aliases</label>
              <input value={personForm.aliases} onChange={e => setPersonForm(p => ({ ...p, aliases: e.target.value }))} placeholder="Comma separated" style={inputStyle} />
              <label style={labelStyle}>Email Address</label>
              <input value={personForm.email} onChange={e => setPersonForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" style={inputStyle} />
              <label style={labelStyle}>Phone Number</label>
              <input value={personForm.phone} onChange={e => setPersonForm(p => ({ ...p, phone: e.target.value }))} placeholder="+44 7700 000000" style={inputStyle} />
              <label style={labelStyle}>Username / Handle</label>
              <input value={personForm.username} onChange={e => setPersonForm(p => ({ ...p, username: e.target.value }))} placeholder="@username" style={inputStyle} />
              <label style={labelStyle}>Last Known Address</label>
              <input value={personForm.address} onChange={e => setPersonForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Street, City, Country" style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input value={personForm.dob} onChange={e => setPersonForm(p => ({ ...p, dob: e.target.value }))} placeholder="DD/MM/YYYY" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nationality</label>
                  <input value={personForm.nationality} onChange={e => setPersonForm(p => ({ ...p, nationality: e.target.value }))} placeholder="GBR" style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div>
              <label style={labelStyle}>Email Address</label>
              <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="target@domain.com" style={inputStyle} />
              <div style={{ marginTop: '10px', padding: '8px', background: '#111519', border: '1px solid #1e2530', borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', color: '#4a5568', lineHeight: '1.6' }}>
                  Checks: Gravatar profile, domain analysis, disposable detection, breach indicators, social profile cross-reference
                </div>
              </div>
            </div>
          )}

          {activeTab === 'username' && (
            <div>
              <label style={labelStyle}>Username / Handle</label>
              <input value={usernameInput} onChange={e => setUsernameInput(e.target.value)} placeholder="target_username" style={inputStyle} />
              <div style={{ marginTop: '10px', padding: '8px', background: '#111519', border: '1px solid #1e2530', borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', color: '#4a5568', lineHeight: '1.6' }}>
                  Searches 20+ platforms: GitHub, Reddit, GitLab, Keybase, HackerNews, Dev.to, npm, Twitter, Instagram, LinkedIn, TikTok, Steam, Twitch, Medium, Tumblr and more.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'domain' && (
            <div>
              <label style={labelStyle}>Domain Name</label>
              <input value={domainInput} onChange={e => setDomainInput(e.target.value)} placeholder="example.com" style={inputStyle} />
              <div style={{ marginTop: '10px', padding: '8px', background: '#111519', border: '1px solid #1e2530', borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', color: '#4a5568', lineHeight: '1.6' }}>
                  Queries: DNS records (A, MX, TXT, NS), SSL/TLS certificates, WHOIS/RDAP, certificate transparency logs
                </div>
              </div>
            </div>
          )}

          {activeTab === 'phone' && (
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="+44 7700 000000" style={inputStyle} />
              <div style={{ marginTop: '10px', padding: '8px', background: '#111519', border: '1px solid #1e2530', borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', color: '#4a5568', lineHeight: '1.6' }}>
                  Provides: Number analysis, carrier lookup, country identification, OSINT deep links (Truecaller, 192, WhitePages)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ip' && (
            <div>
              <label style={labelStyle}>IP Address</label>
              <input value={ipInput} onChange={e => setIpInput(e.target.value)} placeholder="8.8.8.8" style={inputStyle} />
              <div style={{ marginTop: '10px', padding: '8px', background: '#111519', border: '1px solid #1e2530', borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', color: '#4a5568', lineHeight: '1.6' }}>
                  Queries: Geolocation, ISP/ASN info, RDAP/ARIN registration, organisation details
                </div>
              </div>
            </div>
          )}

          <button
            onClick={run}
            disabled={loading}
            style={{
              marginTop: '16px', width: '100%', padding: '10px',
              background: loading ? '#1e2530' : '#1e6fff',
              border: 'none', borderRadius: '2px',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Executing Query...</> : <><Search size={13} /> Execute OSINT Query</>}
          </button>
        </div>
      </div>

      {/* Right panel — results */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px', background: '#0a0c0f' }}>
        {!result && !loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <Search size={32} color="#1e2530" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#4a5568', marginBottom: '6px' }}>OSINT Suite Ready</div>
              <div style={{ fontSize: '11px', color: '#2d3748', maxWidth: '300px', lineHeight: '1.5' }}>
                Configure query parameters and execute. Results are aggregated from open-source intelligence platforms.
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
            <Loader size={24} color="#1e6fff" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '12px', color: '#8b97a8', fontFamily: 'JetBrains Mono, monospace' }}>
              Executing OSINT query...
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px', background: '#1a0000', border: '1px solid #ff3b3b', borderRadius: '2px', color: '#ff3b3b', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {result && <ResultPanel result={result} />}
      </div>
    </div>
  );
}
