import type { Handle } from '@sveltejs/kit';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// Environment / configuration
// These could be moved to a dedicated config file if needed.
const TENANT_DOMAIN = process.env.AZURE_B2C_KNOWN_AUTHORITY || 'satisfactorymanager.b2clogin.com';
const TENANT_DOMAIN_ID = process.env.AZURE_B2C_TENANT_ID || '2b83dcfa-e885-4b3d-a9c9-570fae5ab5c7';
const CLIENT_ID = process.env.AZURE_B2C_CLIENT_ID || '71d43619-ad3d-49d4-bae9-97e38ec57dc4';
// Exposed API scope we expect in `scp` claim (space separated list). Only the scope name portion, not full URI, will appear in scp.
// If your scope is defined as: https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users
// then the token's scp claim should contain "access_users".
const REQUIRED_SCOPE = 'access_users';

// JWKS endpoint pattern for Azure AD B2C (v2). The {policy} part must match the user flow used to issue the token.
// If you have multiple policies, you may need a mapping; for now we assume the single sign-in/sign-up policy used at login.
const POLICY = (process.env.AZURE_B2C_POLICY || 'B2C_1_SignInSignUp').toLowerCase();

// Example: https://<tenant>.b2clogin.com/<tenant>.onmicrosoft.com/<policy>/discovery/v2.0/keys
const jwksUrl = `https://${TENANT_DOMAIN}/${TENANT_DOMAIN.split('.')[0]}.onmicrosoft.com/${POLICY}/discovery/v2.0/keys`;
const jwks = createRemoteJWKSet(new URL(jwksUrl));

// Extend locals with auth info
interface AuthUserLocals {
    sub: string;
    name?: string;
    email?: string;
    scopes?: string[];
    raw: JWTPayload;
}

declare module '@sveltejs/kit' {
    interface Locals {
        user?: AuthUserLocals;
    }
}

async function verifyBearer(token: string): Promise<AuthUserLocals | null> {
    try {
        // Azure AD B2C can emit issuer in two patterns depending on policy / configuration:
        // 1. https://<tenant>.b2clogin.com/<tenantId>/v2.0/
        // 2. https://<tenant>.b2clogin.com/<tenant>.onmicrosoft.com/<policy>/v2.0/
        const issuerStyle1 = `https://${TENANT_DOMAIN}/${TENANT_DOMAIN_ID}/v2.0/`;
        const issuerStyle2 = `https://${TENANT_DOMAIN}/${TENANT_DOMAIN.split('.')[0]}.onmicrosoft.com/${POLICY}/v2.0/`;

        // We can't pass both issuer patterns directly to jose and also allow tokens missing one;
        // Instead, verify signature & audience first, then manually assert issuer matches one of allowed.
        const { payload } = await jwtVerify(token, jwks, {
            audience: CLIENT_ID,
            // Skip 'issuer' option; we'll validate manually to allow either pattern.
        });

        const iss = payload.iss as string | undefined;
        if (!iss || (iss !== issuerStyle1 && iss !== issuerStyle2)) {
            console.warn('Issuer mismatch', { iss, expected: [issuerStyle1, issuerStyle2] });
            return null;
        }

        // Scope check
        const scpRaw = payload['scp'];
        const scopes = typeof scpRaw === 'string' ? scpRaw.split(' ') : [];
        if (!scopes.includes(REQUIRED_SCOPE)) return null;

        return {
            sub: String(payload.sub),
            name: typeof payload.name === 'string' ? payload.name : undefined,
            email: Array.isArray((payload as any).emails) ? (payload as any).emails[0] : (payload as any).email,
            scopes,
            raw: payload
        };
    } catch (e) {
        // Silently ignore invalid tokens; downstream route can decide if auth required
        console.warn('JWT verification failed:', e);
        return null;
    }
}

export const handle: Handle = async ({ event, resolve }) => {
    const authHeader = event.request.headers.get('authorization') || event.request.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring('Bearer '.length).trim();

        const user = await verifyBearer(token);
        if (user) {
            event.locals.user = user;
        }
    }

    return resolve(event);
};
