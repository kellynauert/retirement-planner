import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'

function apiPlugin(): Plugin {
  return {
    name: 'planner-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path !== '/api/scenarios') return next()
        try {
          const mod = (await server.ssrLoadModule('/api/scenarios.ts')) as {
            GET?: (request: Request) => Promise<Response>
            PUT?: (request: Request) => Promise<Response>
          }
          const request = await nodeToWeb(req)
          const handler = req.method === 'PUT' ? mod.PUT : req.method === 'GET' ? mod.GET : undefined
          if (!handler) {
            res.statusCode = 405
            res.end()
            return
          }
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'server error' }))
        }
      })
    },
  }
}

async function nodeToWeb(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? '127.0.0.1'
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  const method = req.method ?? 'GET'
  if (method === 'GET' || method === 'HEAD') {
    return new Request(`http://${host}${req.url}`, { method, headers })
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return new Request(`http://${host}${req.url}`, { method, headers, body: Buffer.concat(chunks) })
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    tailwindcss(),
    react(),
    apiPlugin(),
  ],
  ssr: {
    external: ['pg', '@electric-sql/pglite'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
} as any)
