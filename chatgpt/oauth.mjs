import { createRemoteJWKSet, jwtVerify } from 'jose';

function httpsUrl(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an HTTPS URL`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error(`${name} must be an HTTPS URL without credentials, query or fragment`);
  return url;
}
function authorizationError(code) {
  return Object.assign(new Error(code === 'insufficient_scope' ? 'Required permission is missing' : 'Valid OAuth access token required'), { code });
}

export function createOAuthVerifier({ publicUrl, issuer = process.env.OAUTH_ISSUER || '', jwksUrl = process.env.OAUTH_JWKS_URL || '', audience = process.env.OAUTH_AUDIENCE || '', scopes = process.env.OAUTH_SCOPES || 'resume:use', allowedSubject = process.env.OAUTH_ALLOWED_SUBJECT || '', keyResolver } = {}) {
  if (!issuer && !jwksUrl) {
    if (audience || allowedSubject) throw new Error('OAuth issuer and JWKS URL are required when OAuth restrictions are configured');
    return null;
  }
  const origin = httpsUrl(publicUrl, 'PUBLIC_BASE_URL');
  if (origin.pathname !== '/') throw new Error('PUBLIC_BASE_URL must be an origin without a path');
  httpsUrl(issuer, 'OAUTH_ISSUER');
  const jwks = httpsUrl(jwksUrl, 'OAUTH_JWKS_URL');
  const requiredScopes = [...new Set((Array.isArray(scopes) ? scopes : scopes.split(/\s+/)).filter(Boolean))];
  if (!requiredScopes.length || requiredScopes.some((scope) => !/^[\x21\x23-\x5b\x5d-\x7e]+$/.test(scope))) throw new Error('At least one valid OAuth scope is required');
  const resource = new URL('/mcp', origin).href;
  const expectedAudience = audience || resource;
  const resolver = keyResolver || createRemoteJWKSet(jwks, { timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000 });
  return {
    scopes: requiredScopes,
    metadataUrl: new URL('/.well-known/oauth-protected-resource/mcp', origin).href,
    metadata: { resource, resource_name: 'Folio Resume Studio', authorization_servers: [issuer], scopes_supported: requiredScopes, bearer_methods_supported: ['header'] },
    async verify(authorization) {
      if (typeof authorization !== 'string' || authorization.length > 16384 || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) throw authorizationError('invalid_token');
      const token = authorization.slice(7);
      let payload;
      try {
        ({ payload } = await jwtVerify(token, resolver, { issuer, audience: expectedAudience, algorithms: ['RS256', 'PS256', 'ES256', 'EdDSA'], requiredClaims: ['sub', 'exp'], clockTolerance: 5 }));
      } catch { throw authorizationError('invalid_token'); }
      if (typeof payload.sub !== 'string' || !payload.sub || (allowedSubject && payload.sub !== allowedSubject)) throw authorizationError('invalid_token');
      const grantedScopes = typeof payload.scope === 'string' ? payload.scope.split(/\s+/) : Array.isArray(payload.scp) ? payload.scp.filter((scope) => typeof scope === 'string') : [];
      if (!requiredScopes.every((scope) => grantedScopes.includes(scope))) throw authorizationError('insufficient_scope');
      return { token, clientId: typeof payload.azp === 'string' ? payload.azp : typeof payload.client_id === 'string' ? payload.client_id : 'chatgpt', scopes: grantedScopes, expiresAt: payload.exp, resource: new URL(resource), extra: { subject: payload.sub } };
    },
  };
}
