## Servio Print Agent (LAN)

This is an optional **local** helper that runs on the same network as your receipt printers.

It can:
- Discover printers on your LAN via Bonjour/mDNS (IPP + some raw TCP services)
- Print to common thermal printers via RAW TCP (port 9100)

### Why this exists
Browsers cannot reliably discover LAN printers “nearby” (mDNS is blocked). This agent bridges that gap.

### Run

```bash
cd print-agent
npm install
npm start
```

It listens on `http://localhost:8787`.

### Endpoints
- `GET /health`
- `GET /printers` → discovered printers
- `POST /print` → print a plain-text ticket to a selected printer

### Notes
- iPad/iOS Safari cannot do Bluetooth printer discovery from a web page; use AirPrint or this LAN agent.
- Android/Chrome can do Web Bluetooth for some printers, but LAN is generally more reliable in restaurants.

