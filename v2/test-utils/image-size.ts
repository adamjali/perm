import { readFileSync } from "node:fs";

/**
 * A WebP's pixel size read from its own header (VP8, VP8L or VP8X chunk), so a
 * test can hold an <img>'s declared width and height to the file it points at.
 */
export function webpSize(fileOrBuffer: string | Buffer): { w: number; h: number } {
  const buf = typeof fileOrBuffer === "string" ? readFileSync(fileOrBuffer) : fileOrBuffer;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("not a WebP file");
  }
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff) };
  }
  // Lossy VP8: the frame size sits at bytes 26 to 29.
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
}
