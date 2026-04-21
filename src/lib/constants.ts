export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export const CLASSIFICATION = 'UNCLASSIFIED // FOR OFFICIAL USE ONLY // GLOBAL PRIVATE INTELLIGENCE';

export const WAR_ZONES = [
  {
    id: 'ukraine', name: 'Russia-Ukraine War', status: 'ACTIVE', severity: 'HIGH',
    coordinates: [[22.0,44.0],[40.5,44.0],[40.5,52.5],[22.0,52.5],[22.0,44.0]],
    center: [32.0, 48.5] as [number,number],
    summary: 'Full-scale Russian invasion of Ukraine ongoing since February 2022. Active combat along eastern and southern fronts in Zaporizhzhia, Donetsk and Kherson oblasts.',
    latestUpdate: 'Continued artillery exchanges along Zaporizhzhia and Donetsk frontlines. Drone strikes reported on Kyiv and Kharkiv.',
    casualties: '500,000+ combined est.', startDate: 'Feb 24, 2022',
  },
  {
    id: 'gaza', name: 'Israel-Gaza Conflict', status: 'ACTIVE', severity: 'CRITICAL',
    coordinates: [[34.2,31.2],[34.6,31.2],[34.6,31.6],[34.2,31.6],[34.2,31.2]],
    center: [34.4, 31.4] as [number,number],
    summary: 'Ongoing Israeli military operations in Gaza Strip following October 7, 2023 Hamas attacks.',
    latestUpdate: 'IDF operations continuing. Ceasefire negotiations ongoing via Qatar and Egypt mediators.',
    casualties: '46,000+ Palestinian est., 1,400+ Israeli', startDate: 'Oct 7, 2023',
  },
  {
    id: 'sudan', name: 'Sudan Civil War', status: 'ACTIVE', severity: 'HIGH',
    coordinates: [[22.0,10.0],[38.0,10.0],[38.0,22.0],[22.0,22.0],[22.0,10.0]],
    center: [30.0, 15.0] as [number,number],
    summary: 'Armed conflict between Sudanese Armed Forces and Rapid Support Forces since April 2023.',
    latestUpdate: 'RSF advances in Khartoum and Darfur regions. Humanitarian crisis deepening with millions displaced.',
    casualties: '15,000+ est.', startDate: 'Apr 15, 2023',
  },
  {
    id: 'myanmar', name: 'Myanmar Civil War', status: 'ACTIVE', severity: 'HIGH',
    coordinates: [[92.0,10.0],[101.5,10.0],[101.5,28.5],[92.0,28.5],[92.0,10.0]],
    center: [96.0, 19.0] as [number,number],
    summary: 'Civil conflict following 2021 military coup. Multiple resistance groups fighting junta forces.',
    latestUpdate: 'Three Brotherhood Alliance continues advances. Junta losing territory in multiple regions.',
    casualties: '50,000+ est.', startDate: 'Feb 1, 2021',
  },
  {
    id: 'sahel', name: 'Sahel Insurgency', status: 'ACTIVE', severity: 'MEDIUM',
    coordinates: [[-5.5,10.0],[15.0,10.0],[15.0,20.0],[-5.5,20.0],[-5.5,10.0]],
    center: [4.5, 15.0] as [number,number],
    summary: 'Jihadist insurgency across Mali, Burkina Faso, and Niger. JNIM and ISGS active.',
    latestUpdate: 'Attacks continue in northern Burkina Faso. Wagner/Africa Corps presence reported in multiple zones.',
    casualties: '20,000+ since 2012', startDate: '2012',
  },
  {
    id: 'yemen', name: 'Yemen Conflict', status: 'ACTIVE', severity: 'HIGH',
    coordinates: [[42.5,11.5],[54.0,11.5],[54.0,18.5],[42.5,18.5],[42.5,11.5]],
    center: [47.0, 15.5] as [number,number],
    summary: 'Multi-sided conflict involving Houthi forces, Saudi-led coalition, and various factions.',
    latestUpdate: 'Houthi Red Sea attacks ongoing. Humanitarian crisis severe with 21M in need.',
    casualties: '377,000+ est.', startDate: 'Sep 2014',
  },
];

export const LOCATION_TYPES = [
  { id: 'safehouse', label: 'Safe House', color: '#00ff88', icon: '🏠' },
  { id: 'hostile', label: 'Hostile Territory', color: '#ff3b3b', icon: '⚠' },
  { id: 'extraction', label: 'Extraction Zone', color: '#1e6fff', icon: '↑' },
  { id: 'observation', label: 'Observation Post', color: '#ffb800', icon: '👁' },
  { id: 'cache', label: 'Equipment Cache', color: '#00d4ff', icon: '📦' },
  { id: 'hq', label: 'Command HQ', color: '#a855f7', icon: '★' },
  { id: 'waypoint', label: 'Route Waypoint', color: '#8b97a8', icon: '◆' },
  { id: 'intel', label: 'Intelligence Site', color: '#ff8c00', icon: '🔍' },
];

export const AGENCIES = [
  { country: 'USA', name: 'CIA', full: 'Central Intelligence Agency' },
  { country: 'USA', name: 'FBI', full: 'Federal Bureau of Investigation' },
  { country: 'USA', name: 'NSA', full: 'National Security Agency' },
  { country: 'USA', name: 'DEA', full: 'Drug Enforcement Administration' },
  { country: 'USA', name: 'DHS', full: 'Dept. of Homeland Security' },
  { country: 'USA', name: 'CISA', full: 'Cybersecurity & Infrastructure Security' },
  { country: 'USA', name: 'ATF', full: 'Bureau of Alcohol, Tobacco, Firearms' },
  { country: 'USA', name: 'USSS', full: 'US Secret Service' },
  { country: 'GBR', name: 'MI5', full: 'Security Service' },
  { country: 'GBR', name: 'MI6', full: 'Secret Intelligence Service' },
  { country: 'GBR', name: 'GCHQ', full: 'Govt. Communications HQ' },
  { country: 'GBR', name: 'NCA', full: 'National Crime Agency' },
  { country: 'GBR', name: 'CTP', full: 'Counter Terrorism Policing' },
  { country: 'EUR', name: 'Europol', full: 'European Union Agency for Law Enforcement' },
  { country: 'EUR', name: 'Interpol', full: 'International Criminal Police Organization' },
  { country: 'EUR', name: 'BfV', full: 'German Domestic Intelligence' },
  { country: 'EUR', name: 'DGSI', full: 'French Internal Security' },
  { country: 'INT', name: 'IAEA', full: 'International Atomic Energy Agency' },
  { country: 'INT', name: 'UN OSCC', full: 'UN Office for Outer Space Affairs' },
];
