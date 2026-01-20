/**
 * Fail fast if a TCP port is already in use.
 *
 * Usage:
 *   node scripts/ensure-port.js [port]
 *
 * Defaults:
 *   - port: process.env.PORT || 3000
 */
const net = require('net')

const port = Number(process.argv[2] || process.env.PORT || 3000)
if (!Number.isFinite(port) || port <= 0) {
  // eslint-disable-next-line no-console
  console.error(`[ensure-port] Invalid port: ${process.argv[2] || process.env.PORT}`)
  process.exit(1)
}

const server = net.createServer()
server.unref()

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(
      [
        `[ensure-port] Port ${port} is already in use.`,
        `Stop the process using it (or choose a different port), then rerun.`,
        ``,
        `Helpful commands:`,
        `  lsof -nP -iTCP:${port} -sTCP:LISTEN`,
        `  kill <PID>`,
      ].join('\n')
    )
    process.exit(1)
  }
  // eslint-disable-next-line no-console
  console.error('[ensure-port] Unexpected error:', err)
  process.exit(1)
})

server.listen(port, '127.0.0.1', () => {
  server.close(() => process.exit(0))
})

