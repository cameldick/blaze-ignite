/**
 * Dummy env so modules that validate configuration at import time (the bridge
 * `config`, `crypto`) load cleanly under test. No real secrets — 32 zero bytes.
 */
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32).toString("base64");
process.env.BRIDGE_INTERNAL_SECRET ??= "test-internal-secret";
