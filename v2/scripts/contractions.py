#!/usr/bin/env python3
"""Apply house-style contractions to visible copy.

APOSTROPHE: U+2019, the typographic right single quote, never the ASCII \'.
Three reasons and all of them bite. It is the typographically correct mark
for a contraction. A raw \' inside JSX text trips react/no-unescaped-entities
(158 errors on the first run of this script). And a raw \' inside a
single-quoted JS string terminates it, which took a file out of the build
entirely.

House style is contractions; uncontracted prose is one of the strongest
tells that a machine wrote something. This applies them mechanically, with
the three traps that have bitten this fleet before written into the rules:

1. `have` and `had` contract only as AUXILIARIES. "you've seen it" is right,
   "what you've" for "what you have" is wrong and reads as a typo. Rather
   than try to detect a following participle, this NEVER contracts them.
   The -n't forms are the bulk anyway.

2. A contraction cannot sit clause-final. "no, it isn't." is correct English;
   "how full it's." is a bug, and this site has shipped exactly that. So the
   copula forms require a following WORD, while the -n't forms do not.

3. Quoted material is verbatim. A global replace silently rewrites a customer
   quote or a statute. Fenced code, inline code and HTML entity quotes are
   skipped.

    python3 scripts/contractions.py            # report only
    python3 scripts/contractions.py --write
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# -n't forms. Safe clause-final, so no lookahead beyond a word boundary.
A = "\u2019"  # right single quotation mark

NT = [
    ("is not", "isn" + A + "t"), ("are not", "aren" + A + "t"), ("was not", "wasn" + A + "t"),
    ("were not", "weren" + A + "t"), ("does not", "doesn" + A + "t"), ("do not", "don" + A + "t"),
    ("did not", "didn" + A + "t"), ("has not", "hasn" + A + "t"), ("have not", "haven" + A + "t"),
    ("had not", "hadn" + A + "t"), ("will not", "won" + A + "t"), ("would not", "wouldn" + A + "t"),
    ("could not", "couldn" + A + "t"), ("should not", "shouldn" + A + "t"),
    ("cannot", "can" + A + "t"), ("can not", "can" + A + "t"),
]
# Copula and modal forms. These MUST be followed by another word.
COPULA = [
    ("it is", "it" + A + "s"), ("that is", "that" + A + "s"), ("there is", "there" + A + "s"),
    ("what is", "what" + A + "s"), ("here is", "here" + A + "s"), ("who is", "who" + A + "s"),
    ("we are", "we" + A + "re"), ("you are", "you" + A + "re"), ("they are", "they" + A + "re"),
    ("we will", "we" + A + "ll"), ("you will", "you" + A + "ll"), ("they will", "they" + A + "ll"),
    ("it will", "it" + A + "ll"),
]

TARGETS = [
    (ROOT / "content", ("*.mdx",)),
    (ROOT / "src", ("*.tsx",)),
]
SKIP_DIRS = {"__tests__", "node_modules", ".next", "emails"}


def protect(text: str) -> tuple[str, list[str]]:
    """Blank out regions that must never be rewritten, keeping offsets."""
    held: list[str] = []

    def stash(m: re.Match[str]) -> str:
        held.append(m.group(0))
        return f"\x00{len(held) - 1}\x00"

    # Fenced code, inline code, JSX/HTML attribute values, and typographic
    # quotes (customer quotes, statute text).
    for pat in (
        # Comments first, and they are the big one. This codebase's comments
        # are load-bearing explanations written deliberately; a mechanical
        # rewrite of 300 of them is churn that risks damaging the reasoning
        # they carry, and none of them render. Visible copy only.
        r"\{/\*[\s\S]*?\*/\}",
        r"/\*[\s\S]*?\*/",
        r"^\s*//.*$",
        # SINGLE-QUOTED strings. Inserting an apostrophe into one terminates
        # it and the file stops parsing: `'Cannot persist'` became
        # `'Can't persist'` and took ChatWidgetConnected.tsx out entirely.
        # Double-quoted and template strings hold an apostrophe fine, so only
        # this delimiter is dangerous.
        r"'(?:[^'\\\n]|\\.)*'",
        r"```[\s\S]*?```",
        r"`[^`\n]*`",
        r"&ldquo;[\s\S]*?&rdquo;",
        r"&quot;[\s\S]*?&quot;",
        r'className="[^"]*"',
        r"href=\"[^\"]*\"",
    ):
        text = re.sub(pat, stash, text, flags=re.M)
    return text, held


def restore(text: str, held: list[str]) -> str:
    return re.sub(r"\x00(\d+)\x00", lambda m: held[int(m.group(1))], text)


def apply(text: str) -> tuple[str, int]:
    text, held = protect(text)
    n = 0

    def cased(rep: str, src: str) -> str:
        return rep[0].upper() + rep[1:] if src[0].isupper() else rep

    for src, rep in NT:
        pat = re.compile(rf"\b({src[0].upper()}{src[1:]}|{src})\b")
        text, k = pat.subn(lambda m: cased(rep, m.group(1)), text)
        n += k
    for src, rep in COPULA:
        # Followed by whitespace and a letter: another word follows, so the
        # contraction is not clause-final.
        pat = re.compile(rf"\b({src[0].upper()}{src[1:]}|{src})\b(?=\s+[A-Za-z])")
        text, k = pat.subn(lambda m: cased(rep, m.group(1)), text)
        n += k

    return restore(text, held), n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    total, touched = 0, []
    for base, globs in TARGETS:
        for g in globs:
            for p in sorted(base.rglob(g)):
                if any(part in SKIP_DIRS for part in p.parts):
                    continue
                original = p.read_text()
                out, n = apply(original)
                if n and out != original:
                    total += n
                    touched.append((p.relative_to(ROOT), n))
                    if args.write:
                        p.write_text(out)

    print(f"files scanned under {', '.join(str(b.name) for b, _ in TARGETS)}")
    for rel, n in sorted(touched, key=lambda t: -t[1])[:20]:
        print(f"  {n:>4}  {rel}")
    if len(touched) > 20:
        print(f"  ... and {len(touched) - 20} more files")
    print(f"\n{total} replacements across {len(touched)} files"
          f"{' (WRITTEN)' if args.write else ' (dry run)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
