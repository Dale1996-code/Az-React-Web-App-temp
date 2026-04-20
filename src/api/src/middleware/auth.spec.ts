import express from "express";
import request from "supertest";
import { createAuthMiddleware } from "./auth";

/**
 * Auth middleware tests — focused on the release-risky boundaries:
 *   - Non-production bypass (no token required).
 *   - Production startup fails fast when credentials missing.
 *   - Production rejects requests with no / malformed Bearer tokens.
 *
 * A full positive-path JWT verification is intentionally NOT covered here —
 * it would require mocking live JWKS from Azure Entra ID and adds flakiness
 * without materially improving deploy confidence.
 */
describe("createAuthMiddleware", () => {
    const origEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = origEnv;
    });

    it("returns a pass-through middleware when NODE_ENV is not production", () => {
        process.env.NODE_ENV = "test";
        const mw = createAuthMiddleware({ tenantId: "", clientId: "" });

        const next = jest.fn();
        // Request and response are unused on the bypass path.
        mw({} as express.Request, {} as express.Response, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it("throws at startup when NODE_ENV=production and tenantId is missing", () => {
        process.env.NODE_ENV = "production";
        expect(() => createAuthMiddleware({ tenantId: "", clientId: "client" }))
            .toThrow(/AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID/);
    });

    it("throws at startup when NODE_ENV=production and clientId is missing", () => {
        process.env.NODE_ENV = "production";
        expect(() => createAuthMiddleware({ tenantId: "tenant", clientId: "" }))
            .toThrow(/AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID/);
    });

    describe("NODE_ENV=production with valid config", () => {
        let app: express.Express;

        beforeAll(() => {
            process.env.NODE_ENV = "production";
            const mw = createAuthMiddleware({ tenantId: "tenant-abc", clientId: "client-xyz" });
            app = express();
            app.get("/protected", mw, (_req, res) => res.json({ ok: true }));
        });

        afterAll(() => {
            process.env.NODE_ENV = origEnv;
        });

        it("returns 401 when the Authorization header is missing", async () => {
            const res = await request(app).get("/protected");
            expect(res.status).toBe(401);
            expect(res.body.error).toBe("Unauthorized");
        });

        it("returns 401 when Authorization is not a Bearer token", async () => {
            const res = await request(app)
                .get("/protected")
                .set("Authorization", "Basic abcdef");
            expect(res.status).toBe(401);
        });

        it("returns 401 when the Bearer token is malformed (not three segments)", async () => {
            const res = await request(app)
                .get("/protected")
                .set("Authorization", "Bearer not-a-real-jwt");
            expect(res.status).toBe(401);
        });

        it("returns 401 when the Bearer token uses an unsupported algorithm", async () => {
            // Header declares alg=HS256 (unsupported — only RS256 is accepted).
            const header  = Buffer.from(JSON.stringify({ alg: "HS256", kid: "k" })).toString("base64url");
            const payload = Buffer.from(JSON.stringify({ iss: "x", aud: "client-xyz", exp: 9999999999 })).toString("base64url");
            const signature = "sig";

            const res = await request(app)
                .get("/protected")
                .set("Authorization", `Bearer ${header}.${payload}.${signature}`);
            expect(res.status).toBe(401);
        });
    });
});
