/* eslint-disable no-console */
const http = require('http');
const { URL } = require('url');
const net = require('net');
const { Bonjour } = require('bonjour-service');

const PORT = Number(process.env.PORT || 8787);
const bonjour = new Bonjour();

/** @type {Array<{name?:string, host:string, port:number, type?:string, protocol?:string, txt?:any}>} */
let discovered = [];

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    // CORS (local agent)
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function escposWrapText(text) {
  const init = Buffer.from([0x1b, 0x40]); // ESC @
  const body = Buffer.from(String(text || '').replace(/\r\n/g, '\n') + '\n', 'utf8');
  const cut = Buffer.from([0x1d, 0x56, 0x01]); // GS V 1 (partial cut)
  return Buffer.concat([init, body, cut]);
}

function tcpPrint(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(8000);
    socket.once('error', reject);
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('Printer connection timed out'));
    });
    socket.connect(port, host, () => {
      socket.write(data, (err) => {
        if (err) return reject(err);
        socket.end();
        resolve(true);
      });
    });
  });
}

// Bonjour discovery
function startDiscovery() {
  const handle = (svc) => {
    const host = svc.referer && svc.referer.address ? svc.referer.address : (svc.host || null);
    if (!host) return;
    const entry = {
      name: svc.name,
      host,
      port: svc.port,
      type: svc.type,
      protocol: svc.protocol,
      txt: svc.txt || {}
    };
    // de-dupe
    const key = `${entry.host}:${entry.port}:${entry.type}:${entry.protocol}`;
    const map = new Map(discovered.map((p) => [`${p.host}:${p.port}:${p.type}:${p.protocol}`, p]));
    map.set(key, entry);
    discovered = Array.from(map.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  };

  bonjour.find({ type: 'ipp' }, handle);
  bonjour.find({ type: 'printer' }, handle);
  // Some raw print services advertise as pdl-datastream
  bonjour.find({ type: 'pdl-datastream' }, handle);
}

startDiscovery();

const server = http.createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { success: false, error: 'Missing url' });
  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  const u = new URL(req.url, `http://localhost:${PORT}`);
  const path = u.pathname;

  if (req.method === 'GET' && path === '/health') {
    return json(res, 200, { ok: true, name: 'servio-print-agent', port: PORT, printers: discovered.length });
  }

  if (req.method === 'GET' && path === '/printers') {
    return json(res, 200, { success: true, data: { printers: discovered } });
  }

  if (req.method === 'POST' && path === '/print') {
    try {
      const body = await readBody(req);
      const printer = body.printer || {};
      const host = String(printer.host || '').trim();
      const port = Number(printer.port || 9100);
      const text = body.text;

      if (!host) return json(res, 400, { success: false, error: { message: 'printer.host is required' } });
      if (!Number.isFinite(port) || port <= 0) return json(res, 400, { success: false, error: { message: 'printer.port is invalid' } });

      const payload = escposWrapText(text || '');
      await tcpPrint(host, port, payload);
      return json(res, 200, { success: true });
    } catch (e) {
      return json(res, 500, { success: false, error: { message: e.message || String(e) } });
    }
  }

  return json(res, 404, { success: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[servio-print-agent] listening on http://localhost:${PORT}`);
});

