const SESSION_PAYLOAD = "dashboard:v1";

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((c) => {
    bin += String.fromCharCode(c);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad =
    s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function sha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(message));
  return bufferToHex(buf);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufferToHex(sig);
}

function timingSafeCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Derived signing key from the configured password (no extra env var). */
export async function getCookieSecret(): Promise<string> {
  const p = process.env.DASHBOARD_PASSWORD ?? "";
  return sha256Hex(`dashboard-cookie:${p}`);
}

export async function signToken(secret: string): Promise<string> {
  const sig = await hmacSha256Hex(secret, SESSION_PAYLOAD);
  const combined = `${SESSION_PAYLOAD}.${sig}`;
  return uint8ToBase64Url(new TextEncoder().encode(combined));
}

export async function verifyToken(
  secret: string,
  token: string,
): Promise<boolean> {
  try {
    const combined = new TextDecoder().decode(base64UrlToBytes(token));
    const dot = combined.indexOf(".");
    if (dot < 0) return false;
    const payload = combined.slice(0, dot);
    const sig = combined.slice(dot + 1);
    if (payload !== SESSION_PAYLOAD || sig.length !== 64) return false;
    const expected = await hmacSha256Hex(secret, SESSION_PAYLOAD);
    return timingSafeCompareHex(sig, expected);
  } catch {
    return false;
  }
}

export async function passwordsMatch(
  input: string,
  expected: string,
): Promise<boolean> {
  const ha = await sha256Hex(input);
  const hb = await sha256Hex(expected);
  return timingSafeCompareHex(ha, hb);
}
