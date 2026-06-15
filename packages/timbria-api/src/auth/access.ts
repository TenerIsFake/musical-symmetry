import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Verifier = (token: string | undefined) => Promise<{ email: string } | null>;

// Production verifier: validates the CF Access JWT against the team JWKS + AUD.
// CF_ACCESS_AUD may be a comma-separated list — each Cloudflare Access app on the
// hostname(s) mints its own AUD (e.g. the public app + a no-bypass admin app), and
// a token from ANY of them is accepted (jose validates audience against the array).
export function cfAccessVerifier(): Verifier {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
  const audEnv = process.env.CF_ACCESS_AUD;
  if (!teamDomain || !audEnv) throw new Error('cfAccessVerifier: CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must be set');
  const auds = audEnv.split(',').map((a) => a.trim()).filter(Boolean);
  const JWKS = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  return async (token) => {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: teamDomain, audience: auds });
      return typeof payload.email === 'string' ? { email: payload.email } : null;
    } catch { return null; }
  };
}

export function makeAccessMiddleware(verify: Verifier): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.header('Cf-Access-Jwt-Assertion');
    const id = await verify(token);
    if (id) (req as any).userEmail = id.email;
    next();
  };
}

export function requireOwner(ownerEmail: string): RequestHandler {
  if (!ownerEmail) throw new Error('requireOwner: ownerEmail is required');
  return (req, res, next) => {
    const email = (req as any).userEmail;
    if (typeof email === 'string' && email === ownerEmail) return next();
    return res.status(403).json({ error: 'owner only' });
  };
}
