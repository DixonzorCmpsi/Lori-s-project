import { describe, it, expect } from "vitest";
import { validateImageMagicBytes } from "@/server/storage";

describe("Image magic byte validation", () => {
  // CAST-16: valid JPEG
  it("accepts valid JPEG (FF D8 FF)", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateImageMagicBytes(jpeg)).toBe("jpg");
  });

  // CAST-16: valid PNG
  it("accepts valid PNG (89 50 4E 47)", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(validateImageMagicBytes(png)).toBe("png");
  });

  // CAST-17: reject SVG
  it("rejects SVG (starts with < or <?)", () => {
    const svg = Buffer.from("<?xml version");
    expect(validateImageMagicBytes(svg)).toBeNull();
  });

  // SEC-05: reject SVG with embedded JS
  it("rejects SVG even if disguised", () => {
    const svg = Buffer.from("<svg onload=alert(1)>");
    expect(validateImageMagicBytes(svg)).toBeNull();
  });

  it("rejects GIF", () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
    expect(validateImageMagicBytes(gif)).toBeNull();
  });

  it("rejects WebP", () => {
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(validateImageMagicBytes(webp)).toBeNull();
  });

  it("rejects empty buffer", () => {
    expect(validateImageMagicBytes(Buffer.alloc(0))).toBeNull();
  });

  it("rejects random bytes", () => {
    const random = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    expect(validateImageMagicBytes(random)).toBeNull();
  });
});
