# Use Folio inside ChatGPT

The same visual editor now has two entry points:

- `npm run dev`: the existing offline Ollama application at http://localhost:3000.
- `npm run start:chatgpt`: a stateless MCP connector for the embedded ChatGPT editor.

ChatGPT performs the writing in the embedded version. No OpenAI API key or Ollama
daemon is needed for that version. Keyword diagnostics still run in the editor.

## Build and start

```sh
npm install
npm run build:chatgpt
cp .env.chatgpt.example .env.chatgpt
npm run start:chatgpt
```

The connector listens on `127.0.0.1:8787`. Check
`http://127.0.0.1:8787/health`; the MCP endpoint is `/mcp`.
The HTML resource contains the editor, fonts and export libraries; there are no
external widget asset URLs or direct localhost/Ollama calls in the embedded flow.
This default is for local testing. Loopback-only operation can run without a token;
configuring `PUBLIC_BASE_URL` or a non-loopback `HOST` requires OAuth or a bearer
token of at least 32 characters for a compatible development client. Invalid or
unprotected public configuration fails at startup. ChatGPT requires OAuth for an
authenticated connection; it cannot supply the custom static bearer token.

The current setup is local only. Leave `PUBLIC_BASE_URL` and the OAuth provider
settings blank. No identity provider, tunnel, public hosting, or ChatGPT account
connection is created by these steps.

## Future connection to ChatGPT

ChatGPT must be able to reach the MCP endpoint. A local URL alone will not make
the editor appear in your account. Use a supported private MCP tunnel or a public
HTTPS deployment/tunnel. No tunnel has been started and nothing is published by
the setup commands above.

When you are ready to connect an account, set up an external OAuth 2.1 identity
provider supporting ChatGPT's required client registration and authorization-code
flow with PKCE. Configure JWT access tokens and set `OAUTH_ISSUER`,
`OAUTH_JWKS_URL`, and `OAUTH_AUDIENCE` in `.env.chatgpt`. `OAUTH_SCOPES` defaults
to `resume:use`; grant that API scope at the provider. For personal use, set
`OAUTH_ALLOWED_SUBJECT` to your own provider account's subject identifier.
The connector validates signatures, issuer, audience, expiry, and required scopes.
It publishes protected-resource metadata at
`/.well-known/oauth-protected-resource/mcp` and its root alias. The provider must
publish authorization-server metadata and handle login, consent, client registration,
and token issuance; this connector is only the protected resource.
Do not select unauthenticated access or put secrets into endpoint URLs.

Static `MCP_BEARER_TOKEN` is available for compatible development clients only;
generate one with `openssl rand -hex 32`. It cannot authenticate ChatGPT.
When OAuth is configured, OAuth verification takes precedence over this token.

Only then configure your chosen HTTPS deployment/tunnel. Put its HTTPS origin,
without `/mcp`, into `PUBLIC_BASE_URL` and restart `npm run start:chatgpt`.
The origin must contain no credentials, query, fragment, or path. The connector
accepts only configured Host headers and same-origin browser requests; it does
not trust `X-Forwarded-Host` or expose wildcard browser CORS. Configure a reverse
proxy to preserve the configured public Host header or forward the local one.
Keep the connector and tunnel running only while in use. A tunnel may bypass the
local-only network boundary even when `HOST=127.0.0.1`; its access control still
needs the token or an authenticated gateway.

In ChatGPT:

1. Open Plugins and choose **Add custom MCP server** (some account versions show
   Apps/Developer Mode instead; availability depends on your account/workspace).
2. Enter your HTTPS endpoint with `/mcp` appended and configure OAuth using the
   external identity provider. A static token is not an OAuth implementation.
3. Install/select the resulting personal Folio plugin in a new conversation.
4. Ask: **Open my Folio resume editor.**
5. Paste your resume and job description into the editor, then choose
   **Build my resume**. ChatGPT receives those inputs and calls `present_resume`
   with the structured result. The updated editor may appear as a new card.

Alternatively, attach a resume directly to ChatGPT and ask it to tailor the
resume and show it with the Folio `present_resume` tool.

Refresh the connection after changing tool definitions or metadata.

Official setup reference:
[MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart).
For authentication requirements, see
[OpenAI authentication guide](https://developers.openai.com/plugins/build/auth).

## Editing, downloads and privacy

- The embedded editor does not load or write the standalone application's cache.
  Edits are kept in the current view; download before closing/reopening it.
- Uploading DOCX into the editor extracts text in the widget. Build/Re-Analyze
  explicitly sends the current resume, job description and structured fields to
  the ChatGPT conversation. This version is not an offline/private-to-device workflow.
- The connector does not keep resume records, write documents to disk, call an
  external model API, or share state between users. HTTPS proxies and ChatGPT have
  their own data handling policies.
- PDF, Word and text exports use the host download capability. If a ChatGPT host
  does not support downloads, the editor shows an error; use the standalone app's
  export controls instead. PDF export uses selectable text and embedded fonts,
  with the German A4 margins and date column, rather than iframe printing.
- Profile links use safe HTTP(S) targets. PDF and Word retain clickable links;
  clean text retains the complete URLs for application portals.
- Public/non-loopback configuration requires OAuth or constant-time bearer
  checking for compatible development clients; the health endpoint exposes only
  readiness without a token. Protected-resource metadata is public for discovery.
  Requests have a 2 MiB JSON body limit and bounded header/body receipt time.
  HTTPS and rate limits belong at the deployment gateway; the OAuth authorization
  flow belongs to your external identity provider.
  Never put tokens in tool arguments, URLs, or source control. The connector
  does not issue tokens, implement a login flow, or keep user accounts.

The setup is complete locally only after the build succeeds and the connector
responds. It is installed inside ChatGPT only after you add the reachable endpoint
in your own account and verify a real conversation.
