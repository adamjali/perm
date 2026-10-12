/**
 * The mail Worker's MIME reader (workers/mail/mime.mjs): enough of a message
 * to store its text for the support inbox.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain ES module the Worker bundles; no type declarations.
import { decodeWords, parseAddress, readMessage } from '../../../workers/mail/mime.mjs';

const enc = (s: string) => new TextEncoder().encode(s.replace(/\n/g, '\r\n'));
const latin1 = (s: string) => Uint8Array.from(s.replace(/\n/g, '\r\n'), (c) => c.charCodeAt(0));

describe('readMessage', () => {
  it('reads a plain message with a folded, encoded subject', () => {
    const m = readMessage(
      enc(`From: "Ana Pérez" <ana@example.com>
To: support@permtracker.app
Subject: =?UTF-8?B?Q2FzZSBzdGF0dXMg4oCU?=
 =?UTF-8?Q?_pregunta?=
Message-ID: <m1@example.com>
Content-Type: text/plain; charset=utf-8

Hola, my case is pending.
`),
    );
    expect(m.subject).toBe('Case status — pregunta');
    expect(m.from).toEqual({ name: 'Ana Pérez', address: 'ana@example.com' });
    expect(m.messageId).toBe('<m1@example.com>');
    expect(m.text).toBe('Hola, my case is pending.\r\n');
  });

  it('reads multipart/alternative with quoted-printable and base64 parts, skipping attachments', () => {
    const m = readMessage(
      enc(`From: a@example.com
Subject: Hi
In-Reply-To: <prev@permtracker.app>
Content-Type: multipart/mixed; boundary="outer"

--outer
Content-Type: multipart/alternative; boundary=inner

--inner
Content-Type: text/plain; charset=iso-8859-1
Content-Transfer-Encoding: quoted-printable

Caf=E9 meeting at 3=
 PM
--inner
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: base64

PHA+SGVsbG88L3A+
--inner--
--outer
Content-Type: text/plain
Content-Disposition: attachment; filename="notes.txt"

not this one
--outer--
`),
    );
    expect(m.text).toBe('Café meeting at 3 PM');
    expect(m.html).toBe('<p>Hello</p>');
    expect(m.inReplyTo).toBe('<prev@permtracker.app>');
  });

  it('decodes an 8-bit body in its declared charset', () => {
    const m = readMessage(latin1('Subject: x\nContent-Type: text/plain; charset=iso-8859-1\n\nna\xefve\n'));
    expect(m.text).toBe('naïve\r\n');
  });

  it("doesn't throw on garbage", () => {
    expect(() => readMessage(new Uint8Array([0, 1, 2, 255]))).not.toThrow();
    const m = readMessage(enc('Content-Type: multipart/mixed; boundary=b\n\n--b\nbroken'));
    // A part with nothing after its headers reads as no text.
    expect(m.text ?? '').toBe('');
  });
});

describe('pieces', () => {
  it('leaves plain headers alone and reads a bare address', () => {
    expect(decodeWords('Plain subject')).toBe('Plain subject');
    expect(parseAddress('person@example.com')).toEqual({ name: undefined, address: 'person@example.com' });
  });
});
