import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password";

describe("password verification", () => {
  it("accepts the correct password, rejects a wrong one, and salts each hash", async () => {
    const hash = await hashPassword("a-test-password-123");
    expect(await verifyPassword("a-test-password-123", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
    expect(await hashPassword("a-test-password-123")).not.toBe(hash);
  });

  it("rejects missing or malformed configuration and oversized passwords", async () => {
    for (const hash of [undefined, null, {}, "", "bad:hash", "f".repeat(160)]) {
      expect(await verifyPassword("password", hash)).toBe(false);
    }
    expect(await verifyPassword("x".repeat(257), "0".repeat(32) + ":" + "0".repeat(128))).toBe(false);
  });
});
