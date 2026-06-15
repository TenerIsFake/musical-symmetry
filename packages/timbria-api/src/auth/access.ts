import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Verifier = (token: string | undefined) => Promise<{ email: string } | null>;

// Production verifier: validates the CF Access JWT against the team JWKS + AUD.
export function cfAccessVerifier(): Verifier {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN!; // e.g. https://tendrid.cloudflareaccess.com
  const aud = process.env.CF_ACCESS_AUD!;
  const JWKS = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  return async (token) => {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: teamDomain, audience: aud });
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
  return (req, res, next) => {
    if ((req as any).userEmail === ownerEmail) return next();
    return res.status(403).json({ error: 'owner only' });
  };
}
