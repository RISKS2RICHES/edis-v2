# E-DIS v2 — Enhanced Digital Intelligence Suite

Dark, Palantir-style intelligence dashboard built with React + Vite + Mapbox GL.

## Modules

| Module | Description |
|--------|-------------|
| **Map** | Live threat/event map powered by Mapbox GL JS |
| **Conflicts** | Active global conflict tracker |
| **OSINT** | Open-source intelligence aggregation |
| **Operations** | Field operations management |
| **Pentest** | Penetration testing toolkit |
| **Intelligence** | Signals & human intelligence analysis |

## Stack

- React 18 + TypeScript
- Vite 8
- Mapbox GL JS
- Lucide icons
- Zero UI library dependencies — all inline styles

## Dev

```bash
npm install
npm run dev
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/theoclarke6922/edis-v2)

Set env var `VITE_MAPBOX_TOKEN` in Vercel project settings.

## Env

```
VITE_MAPBOX_TOKEN=pk.your_mapbox_token
```
