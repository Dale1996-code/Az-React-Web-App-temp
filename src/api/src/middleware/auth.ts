import https from "https";
import { createPublicKey, createVerify, JsonWebKey } from "crypto";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "../config/observability";
import { AuthConfig } from "../config/appConfig";

// ---------------------------------------------------------------------------
// Minimal Azure Entra ID JWT validation using Node.js built-in crypto only.
// No external JWT library is required — Node 22's crypto module handles RSA
// key import and RS256 signature verification natively.
// ---------------------------------------------------------------------------

interface JwkEntry {
    kid: string;
    kty: string;
    n: string;
    e: string;
    [k: string]: unknown;
}

interface JwksCacheEntry {
    keys: JwkEntry[];
    fetchedAt: number;
}

interface TokenClaims {
    iss: string;
    aud: string | string[];
    exp: number;
    nbf?: number;
    sub?: string;
}

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const jwksCache = new Map<string, JwksCacheEntry>();

function base64urlToBuffer(s: string): Buffer {
    return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function base64urlDecode(s: string): string {
    return base64urlToBuffer(s).toString("utf8");
}

function fetchJwks(tenantId: string): Promise<JwkEntry[]> {
    const cached = jwksCache.get(tenantId);
    if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
        return Promise.resolve(cached.keys);
    }

    const url = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let body = "";
            res.on("data", (chunk: string) => { body += chunk; });
            res.on("end", () => {
                try {
                    const jwks: { keys: JwkEntry[] } = JSON.parse(body);
                    jwksCache.set(tenantId, { keys: jwks.keys, fetchedAt: Date.now() });
                    resolve(jwks.keys);
                } catch (err) {
                    reject(new Error(`Failed to parse JWKS response: ${err}`));
                }
            });
            res.on("error", reject);
        }).on("error", reject);
    });
}

async function validateToken(token: string, tenantId: string, clientId: string): Promise<void> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed JWT");

    const [headerB64, payloadB64, signatureB64] = parts;

    const header: { alg?: string; kid?: string } = JSON.parse(base64urlDecode(headerB64));
    if (header.alg !== "RS256") throw new Error(`Unsupported algorithm: ${header.alg}`);
    if (!header.kid) throw new Error("JWT header missing kid");

    const claims: TokenClaims = JSON.parse(base64urlDecode(payloadB64));

    // Expiry / not-before
    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < nowSec) throw new Error("Token expired");
    if (claims.nbf && claims.nbf > nowSec + 30) throw new Error("Token not yet valid");

    // Issuer (Azure AD v2 and v1 token formats)
    const validIssuers = [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
    ];
    if (!validIssuers.includes(claims.iss)) {
        throw new Error(`Unexpected issuer: ${claims.iss}`);
    }

    // Audience
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(clientId)) {
        throw new Error("Token audience does not match expected client ID");
    }

    // Signature
    const keys = await fetchJwks(tenantId);
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) {
        // Kid may have rolled — clear cache and retry once
        jwksCache.delete(tenantId);
        const refreshed = await fetchJwks(tenantId);
        const retried = refreshed.find(k => k.kid === header.kid);
        if (!retried) throw new Error(`No signing key found for kid: ${header.kid}`);
        Object.assign(jwk ?? {}, retried);
        return validateSignature(headerB64, payloadB64, signatureB64, retried);
    }

    return validateSignature(headerB64, payloadB64, signatureB64, jwk);
}

function validateSignature(
    headerB64: string,
    payloadB64: string,
    signatureB64: string,
    jwk: JwkEntry,
): void {
    const publicKey = createPublicKey({
        format: "jwk",
        key: { kty: jwk.kty, n: jwk.n, e: jwk.e } as JsonWebKey,
    });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    if (!verifier.verify(publicKey, base64urlToBuffer(signatureB64))) {
        throw new Error("Signature verification failed");
    }
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns an Express middleware that enforces Azure Entra ID Bearer JWT auth
 * on all requests.
 *
 * Production behaviour (NODE_ENV === "production"):
 *   - AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID must both be set.
 *   - Requests without a valid Bearer token receive HTTP 401.
 *   - JWKS keys are cached for 1 hour; a single cache-miss retry handles key
 *     rollovers without a service restart.
 *
 * Development / test behaviour (NODE_ENV !== "production"):
 *   - Auth is bypassed entirely and a warning is logged at startup.
 *   - No Azure AD credentials are required locally.
 */
export const createAuthMiddleware = (config: AuthConfig): RequestHandler => {
    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction) {
        logger.warn(
            "Auth: enforcement disabled — all requests allowed without credentials " +
            "(set NODE_ENV=production and configure AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID to enable)"
        );
        return (_req, _res, next) => next();
    }

    if (!config.tenantId || !config.clientId) {
        // Fail startup rather than silently serving unprotected routes.
        throw new Error(
            "Auth startup error: AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID must both be set " +
            "when NODE_ENV=production. See src/api/README.md for configuration details."
        );
    }

    logger.info(`Auth: Azure Entra ID JWT enforcement enabled (tenant=${config.tenantId})`);

    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        try {
            await validateToken(authHeader.slice(7), config.tenantId, config.clientId);
            next();
        } catch (err) {
            logger.warn(`Auth: token rejected – ${err instanceof Error ? err.message : String(err)}`);
            res.status(401).json({ error: "Unauthorized" });
        }
    };
};
