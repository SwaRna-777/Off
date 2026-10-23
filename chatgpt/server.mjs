import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { resumeSchema, systemPrompt } from '../src/resume-schema.js';
import { createOAuthVerifier } from './oauth.mjs';

const resourceUri = 'ui://folio/resume-studio.html';
const mimeType = 'text/html;profile=mcp-app';
const maxBodyBytes = 2 * 1024 * 1024;

function validateConfig({ port, hostname, token, publicUrl, oauth }) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer between 0 and 65535.');
  if (typeof hostname !== 'string' || !hostname || /[\s/\\?#]/.test(hostname)) throw new Error('HOST must be a hostname or IP address.');
  if (typeof token !== 'string' || /\s/.test(token)) throw new Error('MCP_BEARER_TOKEN must not contain whitespace.');
  let publicOrigin;
  if (publicUrl) {
    const parsed = new URL(publicUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('PUBLIC_BASE_URL must be an HTTPS origin without credentials, a path, query, or fragment.');
    }
    publicOrigin = parsed.origin;
  }
  const loopback = hostname === 'localhost' || hostname === '::1' || (isIP(hostname) === 4 && hostname.startsWith('127.'));
  if ((publicOrigin || !loopback) && !oauth && token.length < 32) {
    throw new Error('Public URLs and non-loopback listeners require OAuth or MCP_BEARER_TOKEN with at least 32 characters.');
  }
  return publicOrigin;
}
function schemaToZod(schema) {
  if (schema.type === 'string') return z.string().max(20000);
  if (schema.type === 'integer') return z.number().int().min(schema.minimum).max(schema.maximum);
  if (schema.type === 'array') return z.array(schemaToZod(schema.items)).max(200);
  return z.object(Object.fromEntries(Object.entries(schema.properties).map(([key, property]) => [key, schema.required.includes(key) ? schemaToZod(property) : schemaToZod(property).optional()])));
}
const contextSchema = {
  resume_text: z.string().max(150000).default(''),
  jd_text: z.string().max(100000).default(''),
  format: z.enum(['international', 'german']).default('international'),
};
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createFolioServer(html, { oauth = null } = {}) {
  const securitySchemes = oauth ? [{ type: 'oauth2', scopes: oauth.scopes }] : [{ type: 'noauth' }];
  const server = new McpServer({ name: 'folio-resume-studio', version: '1.0.0' }, { instructions: `Use open_resume_editor to open the existing visual editor. For tailored resumes, follow these editorial rules and call present_resume with complete structured data: ${systemPrompt} Do not claim that a heuristic score guarantees ATS acceptance. Never infer visa eligibility or missing months. The server does not retain documents.` });
  server.registerResource('folio-editor', resourceUri, { mimeType, description: 'Editable ATS and German Lebenslauf resume studio', _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } } }, async () => ({ contents: [{ uri: resourceUri, mimeType, text: html, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } } }] }));
  server.registerTool('open_resume_editor', {
    title: 'Open Folio resume editor', description: 'Open the visual resume editor. Supply resume and job text already provided by the user, if available. No account or external model API is required.',
    inputSchema: contextSchema, annotations, _meta: { ui: { resourceUri }, securitySchemes },
  }, async (input) => ({ content: [{ type: 'text', text: 'Folio is open. Edit the resume, or use Build my resume to request a ChatGPT rewrite.' }], structuredContent: input }));
  server.registerTool('present_resume', {
    title: 'Display a tailored resume in Folio', description: 'Render a complete fact-supported resume in the visual editor. Use after the user asks to generate or refine their resume. Preserve existing details, languages, projects and contact links. Echo request_id exactly when the editor supplies one.',
    inputSchema: { ...contextSchema, resume: schemaToZod(resumeSchema), request_id: z.string().max(100).optional() }, annotations, _meta: { ui: { resourceUri }, securitySchemes },
  }, async (input) => ({ content: [{ type: 'text', text: 'The tailored resume is ready in the editable Folio document. Review facts and supported achievements before exporting.' }], structuredContent: input }));
  return server;
}

export async function startFolioServer({ port = Number(process.env.PORT || 8787), hostname = process.env.HOST || '127.0.0.1', token = process.env.MCP_BEARER_TOKEN || '', publicUrl = process.env.PUBLIC_BASE_URL || '', oauth } = {}) {
  const oauthVerifier = oauth === undefined ? createOAuthVerifier({ publicUrl }) : oauth;
  const publicOrigin = validateConfig({ port, hostname, token, publicUrl, oauth: oauthVerifier });
  const html = await readFile(new URL('../dist-chatgpt/widget.html', import.meta.url), 'utf8');
  const allowedHosts = new Set(publicOrigin ? [new URL(publicOrigin).host] : []);
  const allowedOrigins = new Set(publicOrigin ? [publicOrigin] : []);
  const expectedAuthorization = token ? Buffer.from(`Bearer ${token}`) : null;
  const httpServer = createServer({ maxHeaderSize: 16384, headersTimeout: 10000, requestTimeout: 30000, keepAliveTimeout: 5000 }, async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (!allowedHosts.has(request.headers.host?.toLowerCase())) { response.writeHead(403, { Connection: 'close' }).end('Host is not configured'); return; }
    if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) { response.writeHead(403, { Connection: 'close' }).end('Origin is not configured'); return; }
    let pathname;
    try {
      if (!request.url?.startsWith('/') || request.url.startsWith('//')) throw new Error('Invalid request target');
      pathname = new URL(request.url, 'http://localhost').pathname;
    } catch { response.writeHead(400, { Connection: 'close' }).end('Invalid URL'); return; }
    if (pathname === '/health' && request.method === 'GET') { response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ service: 'folio', ready: true })); return; }
    if (oauthVerifier && request.method === 'GET' && ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource'].includes(pathname)) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(oauthVerifier.metadata));
      return;
    }
    if (pathname !== '/mcp') { response.writeHead(404).end('Not found'); return; }
    if (oauthVerifier) {
      try { request.auth = await oauthVerifier.verify(request.headers.authorization); }
      catch (error) {
        const insufficientScope = error.code === 'insufficient_scope';
        const challenge = `Bearer resource_metadata="${oauthVerifier.metadataUrl}", scope="${oauthVerifier.scopes.join(' ')}", error="${insufficientScope ? 'insufficient_scope' : 'invalid_token'}"`;
        response.writeHead(insufficientScope ? 403 : 401, { 'WWW-Authenticate': challenge, Connection: 'close' }).end(insufficientScope ? 'Required scope missing' : 'Authentication required');
        return;
      }
    } else if (expectedAuthorization) {
      const supplied = Buffer.from(request.headers.authorization || '');
      if (supplied.length !== expectedAuthorization.length || !timingSafeEqual(supplied, expectedAuthorization)) { response.writeHead(401, { 'WWW-Authenticate': 'Bearer realm="Folio"', Connection: 'close' }).end('Authentication required'); return; }
    }
    if (!['POST', 'GET', 'DELETE'].includes(request.method)) { response.writeHead(405, { Allow: 'POST, GET, DELETE' }).end(); return; }
    let body;
    if (request.method === 'POST') {
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) { response.writeHead(415, { Connection: 'close' }).end('Content-Type must be application/json'); return; }
      if (Number(request.headers['content-length']) > maxBodyBytes) { response.writeHead(413, { Connection: 'close' }).end('Request too large'); return; }
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > maxBodyBytes) { response.writeHead(413, { Connection: 'close' }).end('Request too large'); return; }
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { response.writeHead(400).end('Invalid JSON'); return; }
    }
    const server = createFolioServer(html, { oauth: oauthVerifier });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    response.once('close', () => { void Promise.allSettled([transport.close(), server.close()]); });
    try { await server.connect(transport); await transport.handleRequest(request, response, body); }
    catch { if (!response.headersSent) response.writeHead(500).end('MCP request failed'); }
  });
  httpServer.maxRequestsPerSocket = 100;
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, hostname, () => {
      const boundPort = httpServer.address().port;
      const localHosts = ['localhost', '127.0.0.1', '[::1]'];
      if (!['0.0.0.0', '::'].includes(hostname)) localHosts.push(isIP(hostname) === 6 ? `[${hostname}]` : hostname);
      for (const localHost of localHosts) {
        const origin = new URL(`http://${localHost}:${boundPort}`);
        allowedHosts.add(origin.host);
        allowedOrigins.add(origin.origin);
      }
      httpServer.removeListener('error', reject);
      resolve();
    });
  });
  return httpServer;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startFolioServer();
  const address = server.address();
  console.log(`Folio connector ready on http://${isIP(address.address) === 6 ? `[${address.address}]` : address.address}:${address.port}/mcp`);
}
