import sharp from "sharp";

// Every image a user uploads (listing photos, verification documents) goes
// through here before it is stored. The browser already compresses photos,
// but the server can't trust that: anyone can call the API directly.
//
//  - The type is decided from the file's own bytes, not from what it claims.
//  - It is decoded and re-encoded, so only pixels survive: no EXIF (GPS
//    location of a warehouse or home, camera serial), no embedded scripts,
//    no trailing payloads.
//  - External URLs are refused: an <img src="https://..."> would let whoever
//    runs that server log the IP of every visitor who opens the listing.

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export class ImageRejected extends Error {}

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function cleanImage(input: unknown): Promise<string> {
  if (typeof input !== "string") throw new ImageRejected("Each photo must be an uploaded image.");
  const match = /^data:[^;,]*;base64,([A-Za-z0-9+/=]+)$/.exec(input);
  if (!match) throw new ImageRejected("Photos must be uploaded image files, not links.");

  const buf = Buffer.from(match[1], "base64");
  if (buf.length > MAX_INPUT_BYTES) throw new ImageRejected("Each photo must be under 8 MB.");
  if (!sniff(buf)) throw new ImageRejected("Only JPEG, PNG or WebP photos are accepted.");

  let out: Buffer;
  try {
    out = await sharp(buf, { limitInputPixels: 50_000_000 })
      .rotate() // apply the EXIF orientation before the metadata is dropped
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer(); // sharp writes no metadata unless asked to
  } catch {
    throw new ImageRejected("This photo could not be read. Please try another file.");
  }
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

export async function cleanImages(inputs: unknown[]): Promise<string[]> {
  return Promise.all(inputs.map(cleanImage));
}
