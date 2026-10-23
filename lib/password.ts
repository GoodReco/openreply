import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: unknown): Promise<boolean> {
  if (!password || password.length > 256 || typeof encoded !== "string" || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded)) {
    return false;
  }
  const [salt, expected] = encoded.split(":");
  return timingSafeEqual(await derive(password, salt), Buffer.from(expected, "hex"));
}
