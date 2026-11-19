import { HttpError } from './errors.mjs';

// API Gateway verifies signature, issuer, audience, expiry and required scopes.
// Production uses this subject to query current Team database memberships.
// Token groups are used only by the legacy isolated factory adapter below.
export function accessSubject(event) {
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (!claims || claims.token_use !== 'access' || typeof claims.sub !== 'string' || !claims.sub) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Inicia sesión con una cuenta autorizada.');
  }
  return claims.sub;
}

// Legacy factory-only adapter for isolated tests and the synthetic local demo.
// Production business handlers always inject the Team service authorizer.
export function identity(event) {
  const subject=accessSubject(event);
  const claims=event.requestContext.authorizer.jwt.claims;
  let groups = claims['cognito:groups'];
  if (typeof groups === 'string') {
    try { groups = JSON.parse(groups); }
    catch {
      const serialized = groups.trim();
      const list = serialized.startsWith('[') && serialized.endsWith(']') ? serialized.slice(1,-1) : serialized;
      groups = list.split(',').map(value => value.trim());
    }
  }
  if (!Array.isArray(groups)) groups = [];
  const memberships = groups.filter(group => typeof group === 'string' && /^org:[a-zA-Z0-9_-]{1,64}:(admin|seller|reader)$/.test(group));
  if (memberships.length !== 1) throw new HttpError(403, 'MEMBERSHIP_REQUIRED', 'La cuenta necesita una sola organización y un rol asignado.');
  const [, organizationId, role] = memberships[0].split(':');
  return { subject, organizationId, role };
}

export function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw new HttpError(403, 'FORBIDDEN', 'Tu rol no permite esta operación.');
}
