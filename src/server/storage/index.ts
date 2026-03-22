import { randomUUID } from "crypto";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_UPLOAD_DIR = join(process.cwd(), "uploads", "headshots");

/** Validate image by magic bytes. Returns the extension or null if invalid. */
export function validateImageMagicBytes(buffer: Buffer): "jpg" | "png" | null {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  return null;
}

/** Upload a file to storage. Returns the filename (UUID.ext). */
export async function uploadHeadshot(buffer: Buffer, ext: "jpg" | "png"): Promise<string> {
  const filename = `${randomUUID()}.${ext}`;

  if (STORAGE_PROVIDER === "supabase") {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/headshots/${filename}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": ext === "jpg" ? "image/jpeg" : "image/png",
        },
        body: new Uint8Array(buffer),
      }
    );
    if (!res.ok) throw new Error(`Supabase upload failed: ${res.status}`);
  } else {
    if (!existsSync(LOCAL_UPLOAD_DIR)) {
      await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    }
    await writeFile(join(LOCAL_UPLOAD_DIR, filename), buffer);
  }

  return filename;
}

/** Delete a file from storage. */
export async function deleteHeadshot(filename: string): Promise<void> {
  if (STORAGE_PROVIDER === "supabase") {
    await fetch(
      `${SUPABASE_URL}/storage/v1/object/headshots/${filename}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      }
    );
  } else {
    try {
      await unlink(join(LOCAL_UPLOAD_DIR, filename));
    } catch {
      // File may not exist — that's fine
    }
  }
}

/** Read a file from storage. Returns buffer or null. */
export async function readHeadshot(filename: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const contentType = filename.endsWith(".png") ? "image/png" : "image/jpeg";

  if (STORAGE_PROVIDER === "supabase") {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/headshots/${filename}`,
      {
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      }
    );
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
  } else {
    try {
      const buffer = await readFile(join(LOCAL_UPLOAD_DIR, filename));
      return { buffer, contentType };
    } catch {
      return null;
    }
  }
}
