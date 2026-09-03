"""Check the article set before any of it ships.

Written after 24 articles were generated in parallel by separate agents, which
is exactly the situation where a shared rule gets followed 23 times. Every
check here corresponds to something that would actually be wrong on the page:
a broken image, a false capability claim, a link to nothing, a house-style
violation the site gates elsewhere.

Prints its counts BEFORE its verdict, and carries a control, so a run that
silently scanned nothing cannot read as a pass.
"""
import pathlib, re, sys, json

ROOT = pathlib.Path(".")
GUIDES = ROOT / "content/guides"
SHOTS = ROOT / "public/images/content/shots"
REQUIRED = ["title", "description", "date", "author", "image", "imageAlt",
            "tags", "category", "seoTitle", "seoDescription", "published"]

# Claims that are false about this product, or that we never make.
# A claim is only a claim when it is ASSERTED. Three shapes are not:
#   "It isn't real time"        - the article denying it, which is what we want
#   "a month of real time"      - ordinary English, not a product claim
#   "you'll read that DOL only exposes decided records"  - debunking the myth
# The first run of this gate reported 8 findings and 6 were these. A detector
# that cannot tell an assertion from its denial punishes the careful writer.
NEGATED = r"(is ?n[o']t|are ?n[o']t|never|not\s+)\s*$"
DEBUNK = r"(you.ll read|widely|myth|isn.t (right|true)|that.s wrong|a lot of places|commonly said|often claimed)"

BANNED = [
    (r"\breal[- ]time\b", "says real-time; DOL data is refreshed daily"),
    (r"only (shows|exposes|returns)[^.]{0,40}decided", "repeats the false 'DOL hides pending PWD' claim"),
    (r"cannot be (tracked|looked up)[^.]{0,30}pending", "says pending cases cannot be tracked"),
    (r"\u2014", "em-dash (house style forbids it)"),
    (r"\bdive into\b|\btapestry\b|\btestament to\b|\bseamless\b|\belevate\b", "marketing filler"),
    (r"!(?!\[)(?![=~])", "exclamation mark"),
]

# Statements that trip a rule and are TRUE, each with the reason it is allowed.
# Classified rather than suppressed: an entry here is a claim that the phrase is
# accurate in that context, not a request for the gate to look away. "Real time"
# applied to a chat reply or to browser-side validation IS real time; the rule
# exists for claims about how fresh DOL's data is.
ALLOWED = [
    ("getting-started.mdx", "regulation questions in real time",
     "the assistant does reply immediately; not a claim about DOL data"),
    ("ultimate-perm-guide-2026.mdx", "Real-time checks for common filing errors",
     "form validation in the browser is immediate; not about DOL data"),
    ("ultimate-perm-guide-2026.mdx", "documenting every step in real time",
     "advice to the reader about their own record-keeping"),
]

def allowed(rel, body, m):
    window = body[max(0, m.start() - 60):m.start() + 60]
    return any(f == rel and frag in window for f, frag, _ in ALLOWED)

def asserted(body, m):
    """True when the match is a claim rather than a denial or a debunking."""
    before = body[max(0, m.start() - 60):m.start()]
    sentence = body[max(0, m.start() - 220):m.end() + 60]
    if re.search(NEGATED, before, re.I):
        return False
    if re.search(DEBUNK, sentence, re.I):
        return False
    # "a month of real time passes" is time, not a product claim.
    if re.search(r"(month|year|week|day|hour)s?\s+of\s+$", before, re.I):
        return False
    if re.search(r"real[- ]time\s+passes", body[m.start():m.start() + 30], re.I):
        return False
    return True

def frontmatter(text):
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---", 3)
    if end == -1:
        return None, text
    fm = {}
    for line in text[3:end].splitlines():
        m = re.match(r"^(\w+):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"')
    return fm, text[end + 4:]

def main():
    # Both content sections: six pieces moved guides -> blog on 2026-09-03, and
    # a gate that only knew one of them reported every cross-link as broken.
    files = sorted(GUIDES.glob("*.mdx")) + sorted((ROOT / "content/blog").glob("*.mdx"))
    shots = {p.stem for p in SHOTS.glob("*.webp")}
    slugs = {p.stem for p in files}
    # Every internal route the articles may link to, from the live sitemap list
    # plus the guide slugs themselves.
    routes = set(json.load(open("scripts/known-routes.json"))) if pathlib.Path("scripts/known-routes.json").exists() else set()
    # Real routes that are deliberately kept out of the sitemap (noindex).
    routes |= {"/signup", "/login", "/settings", "/dashboard", "/cases"}

    print(f"scanned {len(files)} articles, {len(shots)} screenshots available")
    print(f"{len(ALLOWED)} classified false positive(s), each with a stated reason")
    problems = []
    for f in files:
        text = f.read_text()
        fm, body = frontmatter(text)
        rel = f.name
        if fm is None:
            problems.append((rel, "no frontmatter")); continue
        for k in REQUIRED:
            if k not in fm:
                problems.append((rel, f"frontmatter missing {k}"))
        if len(fm.get("title", "")) > 65:
            problems.append((rel, f"title {len(fm['title'])} chars"))
        if len(fm.get("seoDescription", "")) > 155:
            problems.append((rel, f"seoDescription {len(fm['seoDescription'])} chars (limit 155)"))
        if len(fm.get("description", "")) > 155:
            problems.append((rel, f"description {len(fm['description'])} chars (limit 155, matching content-frontmatter.test.ts)"))

        # Every referenced screenshot must exist on disk.
        for src in re.findall(r'src="/images/content/shots/([\w-]+)\.webp"', text):
            if src not in shots:
                problems.append((rel, f"missing screenshot: {src}.webp"))
        hero = fm.get("image", "")
        if hero.startswith("/images/content/shots/"):
            stem = hero.rsplit("/", 1)[-1].removesuffix(".webp")
            if stem not in shots:
                problems.append((rel, f"missing hero image: {stem}.webp"))

        # Internal links must point at a route or a guide that exists.
        for href in re.findall(r"\]\((/[\w\-/]*)\)", body):
            h = href.rstrip("/")
            if h.startswith("/guides/") or h.startswith("/blog/"):
                slug = h.rsplit("/", 1)[-1]
                if slug not in slugs:
                    problems.append((rel, f"link to missing article: {href}"))
            elif routes and h not in routes:
                problems.append((rel, f"link to unknown route: {href}"))

        for pat, why in BANNED:
            for m in re.finditer(pat, body, re.I):
                if not asserted(body, m) or allowed(rel, body, m):
                    continue
                frag = body[max(0, m.start()-40):m.start()+40].replace("\n", " ")
                problems.append((rel, f"{why}: ...{frag.strip()}..."))

        words = len(re.findall(r"\b\w+\b", re.sub(r"<[^>]+>", " ", body)))
        if words < 500:
            problems.append((rel, f"only {words} words"))

    # Control: the checker must be able to SEE a defect. Feed it one.
    probe = "---\ntitle: x\n---\nThis is a real-time test — with an em-dash!\n"
    fmp, bodyp = frontmatter(probe)
    seen = sum(1 for pat, _ in BANNED if re.search(pat, bodyp, re.I))
    print(f"control: a planted line trips {seen} of {len(BANNED)} rules "
          f"({'ok' if seen >= 3 else 'DETECTOR BROKEN'})")

    if problems:
        print(f"\n{len(problems)} problem(s):")
        for rel, p in problems:
            print(f"  {rel}: {p}")
        return 1
    print("\nall clear")
    return 0

if __name__ == "__main__":
    sys.exit(main())
