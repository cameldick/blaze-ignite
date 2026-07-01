import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "./config.js";

/**
 * AES-256-GCM token encryption. Stored format: base64(iv).base64(tag).base64(ct)
 * Key is 32 bytes, base64-encoded in TOKEN_ENCRYPTION_KEY.
 */
const key = Buffer.from(config.TOKEN_ENCRYPTION_KEY, "base64");
if (key.length !== 32) {
  throw new Error(
    "TOKEN_ENCRYPTION_KEY must decode to 32 bytes (generate: openssl rand -base64 32)",
  );
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptToken(stored: string): string {
  const [ivB64, tagB64, ctB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("malformed encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
