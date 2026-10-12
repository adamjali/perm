/**
 * A small MIME reader: just enough to store an inbound message's text for the
 * support inbox. The original message always reaches the owner's inbox intact
 * (forwarded), so this is a readable copy, not the record. It handles header
 * folding, RFC 2047 encoded words, nested multipart, base64 and
 * quoted-printable, and charsets through TextDecoder. A full parser
 * (postal-mime) bundled to 74 KB, most of it an HTML entity table.
 */

const MAX_DEPTH = 6;
const MAX_PARTS = 60;

function decoder(charset) {
  try {
    return new TextDecoder((charset || "utf-8").trim().replace(/^"|"$/g, "") || "utf-8");
  } catch {
    return new TextDecoder("windows-1252");
  }
}

/** Bytes as a one-char-per-byte string, so structure can be found with string tools. */
export function bytesToBinary(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return s;
}

function binaryToBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function base64Bytes(s) {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const padded = clean + "===".slice((clean.length + 3) % 4);
  try {
    return binaryToBytes(atob(padded.length % 4 === 0 ? padded : clean.slice(0, clean.length - (clean.length % 4))));
  } catch {
    return new Uint8Array();
  }
}

function quotedPrintableBytes(s, underscoreIsSpace = false) {
  if (underscoreIsSpace) s = s.replace(/_/g, " ");
  s = s.replace(/=\r?\n/g, "");
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const hex = s.slice(i + 1, i + 3);
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      out.push(parseInt(hex, 16));
      i += 2;
    } else {
      out.push(s.charCodeAt(i) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** "=?UTF-8?B?...?=" and "=?iso-8859-1?Q?...?=" words decoded; anything else as it is. */
export function decodeWords(value) {
  if (!value) return value;
  return value
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[^?]+\?[BbQq]\?)/g, "$1")
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
      const bytes = enc.toUpperCase() === "B" ? base64Bytes(text) : quotedPrintableBytes(text, true);
      return decoder(charset.split("*")[0]).decode(bytes);
    });
}

/** "Name <a@b>" or "a@b" as { name, address }. */
export function parseAddress(value) {
  const v = decodeWords(value || "").trim();
  const m = v.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, "").trim() || undefined, address: m[2].trim() };
  return { name: undefined, address: v };
}

/** Headers may carry raw UTF-8 (RFC 6532) as well as encoded words. */
function parseHeaders(binaryBlock) {
  const block = /[\x80-\xff]/.test(binaryBlock) ? decoder("utf-8").decode(binaryToBytes(binaryBlock)) : binaryBlock;
  const headers = {};
  for (const line of block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    if (!(key in headers)) headers[key] = line.slice(i + 1).trim();
  }
  return headers;
}

function headerParams(value) {
  const [main, ...rest] = (value || "").split(";");
  const params = {};
  for (const p of rest) {
    const i = p.indexOf("=");
    if (i > 0) params[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return { value: (main || "").trim().toLowerCase(), params };
}

function walk(binary, depth, found, count) {
  if (depth > MAX_DEPTH || count.n++ > MAX_PARTS) return;
  const split = binary.search(/\r?\n\r?\n/);
  const head = split < 0 ? binary : binary.slice(0, split);
  const body = split < 0 ? "" : binary.slice(split).replace(/^\r?\n\r?\n/, "");
  const headers = parseHeaders(head);
  const type = headerParams(headers["content-type"] || "text/plain");
  const disposition = headerParams(headers["content-disposition"]).value;

  if (type.value.startsWith("multipart/") && type.params.boundary) {
    // Plain string splitting: a regex built from the message's own boundary
    // would be a pattern chosen by whoever sent it.
    for (const piece of body.split(`--${type.params.boundary}`).slice(1)) {
      if (piece.startsWith("--")) break; // the closing delimiter
      const part = piece.replace(/^[ \t]*\r?\n/, "").replace(/\r?\n$/, "");
      if (part.trim().length) walk(part, depth + 1, found, count);
    }
    return;
  }
  if (disposition === "attachment") return;
  if (type.value !== "text/plain" && type.value !== "text/html") return;
  const key = type.value === "text/plain" ? "text" : "html";
  if (found[key] !== undefined) return;

  const encoding = (headers["content-transfer-encoding"] || "").trim().toLowerCase();
  const bytes =
    encoding === "base64" ? base64Bytes(body) : encoding === "quoted-printable" ? quotedPrintableBytes(body) : binaryToBytes(body);
  found[key] = decoder(type.params.charset).decode(bytes);
}

/**
 * The parts a person reads, from a raw message: { subject, from, messageId,
 * inReplyTo, references, text, html }. Never throws; a part it can't read is
 * left out.
 */
export function readMessage(bytes) {
  const binary = bytesToBinary(bytes);
  const split = binary.search(/\r?\n\r?\n/);
  const headers = parseHeaders(split < 0 ? binary : binary.slice(0, split));
  const found = {};
  try {
    walk(binary, 0, found, { n: 0 });
  } catch {
    // A malformed body leaves whatever was read.
  }
  return {
    subject: headers.subject !== undefined ? decodeWords(headers.subject) : undefined,
    from: parseAddress(headers.from),
    messageId: headers["message-id"],
    inReplyTo: headers["in-reply-to"],
    references: headers.references,
    text: found.text,
    html: found.html,
  };
}
