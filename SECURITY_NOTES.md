# Local security status

Reviewed on 2026-10-21. This describes implemented controls and known limitations,
not an independent security certification.

## Local and remote use

The default connector binds to `127.0.0.1`. No public tunnel or account connection
is configured. A public origin or non-loopback listener requires OAuth verification
or a long development bearer token; startup rejects unprotected remote settings.
ChatGPT requires the OAuth route for authenticated connections. The resource server
is prepared for an external issuer/JWKS provider, but no provider is configured.
Do not treat a static development token as a ChatGPT OAuth implementation.

The connector checks Host and browser Origin, bounds request headers/body/time,
validates resume arguments, and does not retain resume records or run shell commands.
OAuth verification checks asymmetric signatures, issuer, audience, subject, expiry
and scopes. A personal subject allowlist is optional. Provider-side login, PKCE,
consent, client registration, revocation and account access remain the provider's job.

The widget validates received data, bounds host operations, supports reconnects,
and preserves newer edits when delayed results arrive. It does not read the standalone
app's cache. Build/Re-Analyze sends resume information to ChatGPT; resetting the
editor does not remove conversation messages. Exports remain on the user's computer.

The standalone app stores its own inputs locally. Reset removes only its four known
cache keys. DOCX imports are limited to 5 MB and extracted text to 150,000 characters;
these limits are not a complete sandbox for hostile documents. Use documents you trust.
The local Ollama wildcard was removed from the login environment and shell configuration.
Checks confirmed localhost editor CORS succeeds and an unrelated HTTPS origin is rejected.

## Dependency review

Tailwind 4 and its PostCSS integration replace the vulnerable Tailwind 3 build tree.
The current audit has **3 moderate advisories and 0 high/critical advisories**.
The remaining path is `mammoth → argparse → sprintf-js`; the affected formatting
code belongs to Mammoth's unused CLI dependency chain. The app imports
`mammoth/mammoth.browser`, whose bundle excludes argparse/sprintf-js. The connector
does not import Mammoth. There is no compatible upstream patch at review time;
npm's proposed ancient Mammoth downgrade was deliberately not applied.

Recheck `npm audit` before remote deployment. Do not use an audit count alone as
proof that an application or newly introduced dependency is safe.

## Validation

Checks cover loopback MCP initialization/tools/resources, rejected malformed/oversized
requests, Host/Origin handling, static development authentication, OAuth signature and
claim rejection, protected-resource discovery, browser allowlist behavior, host bridge
handshake/action/cleanup, PDF generation and the standalone/embedded production builds.
A real OAuth account connection and ChatGPT conversation remain unverified until a
provider and a reachable private/HTTPS endpoint are configured.
