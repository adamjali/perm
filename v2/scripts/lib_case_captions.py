"""Case captions with people's names reduced to initials, for the policy feed.

Two readers put case names on a public page: the federal court opinions
(`ingest_court_opinions.py`) and OALJ's BALCA caselists (`ingest_balca.py`).
A caption often names a person: the visa applicant suing the State
Department, the sole proprietor whose H-2A application was denied. The page
names the case without naming the person.

THE RULE. A caption is split into its parties ("A v. B"; "In re A"; "Matter
of A"; "A et al."; "A d/b/a B"), and each party is one of:

- an agency, an organization or an official: kept as printed. An
  organization is a party with a word only a business, school, union or
  government body carries (LLC, Inc., University, Farms, Department, the
  possessive of a trade name such as "Morin's" ...). An official is a federal
  officer sued in office, by surname, inside the years they held it (Rubio,
  Noem, Mullin, Bondi ...): CourtListener shortens "Marco Rubio, Secretary
  of State" to "Rubio".
- already anonymous: initials ("J.G.G.") or a pseudonym ("Doe"): kept.
- a person: each word of the name becomes its initial and a period
  ("Khaboshan" becomes "K.", "Philip Johnson" becomes "P.J.").
- anything else: the caption is HELD. It goes in `policy_held` for a person
  to look at, never on the page. Each reader's `--release` records the ruling.

Which marker-less names count as a person depends on where the caption came
from (`context`). In a federal court caption a party of name words only is a
person: companies there carry Inc., LLC or Corp. In an OALJ caption, where
almost every party is an employer, it's a person only when it opens with a
common given name ("Philip Johnson"); a bare two-word trade name ("Sushi
Shogun") is held rather than guessed.

Words that are also common surnames or given names (Church, Law, Snow, Pool,
Lodge, Marina ...) are left out of the organization words on purpose: a
business named that way is held, never a person printed whole.

The abstract is a snippet of the opinion or OALJ's headnote, and it can name
people too. `safe_abstract` turns the caption's people into their initials,
and any honorific name ("Ms. Smith") into the honorific and initials, then
drops the abstract (keeping the row) if a capitalised word is left that isn't
known vocabulary or one of the caption's organizations: losing an abstract
costs a reader one paragraph, and a printed name can't be taken back.

Pure functions, except the held list at the end, which lives in the database.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field

# --------------------------------------------------------------------------
# Vocabulary
# --------------------------------------------------------------------------

# A word that makes a party an organization or a government body. Lowercase,
# compared with a party's words after punctuation is taken off.
ORG_WORDS = frozenset("""
inc incorporated llc l.l.c llp lp ltd limited corp corporation co company companies plc pllc pc p.c
gmbh lllp association associates assn coalition advocates council foundation fund institute institution
university college school schools academy district center centre hospital hospitals clinic health
healthcare medical pharmacy dental group holdings partners partnership enterprises industries
international global america american usa national services service solutions systems technologies
technology tech software consulting consultants staffing labor labour contractors contracting
construction concrete builders building homes properties realty management transport transportation
trucking logistics cargo shipping farm farms farming ranch ranches dairy orchard orchards vineyard
vineyards nursery nurseries greenhouse greenhouses growers produce harvesting packing packers
seafood seafoods fisheries crab oyster landscaping landscape landscapes lawn lawns garden gardens
turf sod tree trees forestry timber golf club resort hotel hotels inn restaurant restaurants cafe grill
catering bakery foods food market store shop gallery carpet tile ceramic painting roofing plumbing
electric electrical masonry cleaning janitorial maintenance pools ski rentals rental racing stable
stables shows amusements carnival carnivals rides entertainment media studio studios design engineering
architects firm agency insurance motors auto automotive equipment supply supplies distribution
distributors imports exports trading ventures capital investments investment energy oil gas mining
metals plastics chemical chemicals labs laboratories laboratory research pharmaceuticals biotech sciences
network networks communications telecom wireless digital data union federation chamber league alliance
project committee cooperative co-op trust bank ministries ministry mosque synagogue society organization
works manufacturing products concessions hospitality endoscopy devices winery wineries meats pastures
cleaners lawncare painters robotics travel pets waterproofing formalwear erectors encampment conference pub
iglesia pentecostal baptist removal cares care venture ventures guesthouse sch dist mun int'l intl mfg rest
assoc bros svcs svc hosp ctr univ inst
department dept dep't secretary general director commissioner administrator administration bureau
office board commission authority government federal state commonwealth county city town village
municipal public embassy consulate court tribunal officer certifying division
uscis dhs dol eta ice cbp doj fbi ofccp whd oflc
""".split())

# Phrases that mark a government party on their own.
AGENCY_PHRASES = re.compile(
    r"\b(United States|U\. ?S\.|Citizenship and Immigration|Homeland Security|Immigration and Customs"
    r"|Customs and Border|Department of|Secretary of|Attorney General|Wage and Hour|Foreign Labor)\b",
    re.I,
)

# Federal officers named as parties by surname, with the years they held the
# office (end None while serving). A surname counts as an official only in a
# caption dated from the start year to three years after the end, because a
# suit keeps the old name until the court substitutes the successor.
OFFICIALS: dict[str, list[tuple[int, int | None]]] = {
    # Presidents
    "trump": [(2017, 2021), (2025, None)], "biden": [(2021, 2025)], "obama": [(2009, 2017)],
    # Secretaries of State
    "rubio": [(2025, None)], "blinken": [(2021, 2025)], "pompeo": [(2018, 2021)], "tillerson": [(2017, 2018)],
    "kerry": [(2013, 2017)], "clinton": [(2009, 2013)],
    # Secretaries of Homeland Security (and Mayorkas as USCIS director first)
    "mullin": [(2026, None)], "noem": [(2025, 2026)], "mayorkas": [(2009, 2013), (2021, 2025)],
    "wolf": [(2019, 2021)], "mcaleenan": [(2019, 2019)], "nielsen": [(2017, 2019)], "duke": [(2017, 2017)],
    "kelly": [(2017, 2017)], "johnson": [(2013, 2017)], "napolitano": [(2009, 2013)],
    # Attorneys General
    "blanche": [(2026, None)], "bondi": [(2025, 2026)], "garland": [(2021, 2025)], "wilkinson": [(2021, 2021)],
    "rosen": [(2020, 2021)], "barr": [(2019, 2020)], "whitaker": [(2018, 2019)], "sessions": [(2017, 2018)],
    "lynch": [(2015, 2017)], "holder": [(2009, 2015)],
    # Secretaries of Labor
    "chavez-deremer": [(2025, None)], "su": [(2023, 2025)], "walsh": [(2021, 2023)], "scalia": [(2019, 2021)],
    "acosta": [(2017, 2019)], "perez": [(2013, 2017)],
    # USCIS directors
    "edlow": [(2025, None)], "jaddou": [(2021, 2025)], "cuccinelli": [(2019, 2021)], "cissna": [(2017, 2019)],
    "rodriguez": [(2014, 2017)],
    # ICE heads, named in some visa and detention suits
    "lyons": [(2025, None)], "homan": [(2017, 2018)],
}
# Surnames common enough that a private party may carry one: an official only
# in a later position of the caption, never the first.
COMMON_OFFICIAL_SURNAMES = frozenset(
    "johnson kelly duke wolf lynch holder barr rosen sessions walsh su perez rodriguez acosta scalia lyons"
    " clinton wilkinson".split())

# Pseudonyms a court gives a party it protects: already anonymous.
PSEUDONYMS = frozenset("doe roe does roes".split())

# Common given names, for OALJ captions only: "Philip Johnson" is a sole
# proprietor, "Sushi Shogun" a restaurant. Only a caption's first word is
# compared, and a miss holds the caption instead of guessing.
GIVEN_NAMES = frozenset("""
aaron abdul abigail adam adrian ahmed aisha alan albert alberto alejandro alex alexander alexandra alfredo ali
alice alicia allen alma alvaro amanda amber amir amit amy ana andre andrea andres andrew angel angela anil anita
ann anna anne anthony antonio april arjun arthur arturo ashley barbara benjamin betty beverly bill billy bobby
brandon brenda brian bruce bryan carl carla carlos carmen carol caroline carolyn catherine cesar charles
charlotte cheryl chris christian christina christine christopher cindy claudia craig crystal cynthia daniel
danielle david dean debbie deborah debra denise dennis derek diana diane diego dolores donald donna doris
dorothy douglas dylan earl eddie edgar eduardo edward elaine elena elizabeth ellen emily emma enrique eric
erica erik ernesto esther ethan eugene evelyn fatima felipe fernando frances francisco frank fred gabriel
gary george gerald gerardo gloria gonzalo grace greg gregory guadalupe guillermo hannah harold harry heather
hector helen henry hugo ian irene isabel jack jacob jacqueline james jamie jane janet janice jason javier jay
jean jeffrey jennifer jeremy jerry jesse jessica jesus jill jim jimmy joan joe joel john johnny jonathan jorge
jose joseph joshua joyce juan judith judy julia julie justin karen kathleen kathryn kathy keith kelly kenneth
kevin kimberly kyle larry laura lauren lawrence leonardo leslie linda lisa lori louis lucas luis luz lynn
manuel marco marcos margaret maria marie marilyn mario mark martha martin mary mateo matthew megan melissa
michael michelle miguel mike mohamed mohammad mohammed monica nancy natalie nathan nicholas nicole oscar
pablo pamela patricia patrick paul paula pedro peter philip phillip priya rachel rafael rahul rajesh ralph
ramon randy raul ray raymond rebecca renee rey ricardo richard rick robert roberto rodolfo roger ronald rosa
rose roy ruben russell ruth ryan salvador samantha samuel sandra santiago sara sarah scott sean sergio
sharon shirley stephanie stephen steve steven sunil susan teresa terry thomas timothy tina todd tom tony
travis tyler veronica victor victoria vincent virginia walter wayne wei william willie xavier yolanda zachary
abdullah adriana agnes aidan alba alberta aleksandr alexis alfonso alina alison amelia ana andrei anil anton
antonella armando arnold aurora beatriz bernard blanca bogdan carina cecilia celia chen colin constance cristina
daisy dalia daniela dario deepak dimitri dina dmitri dorota edith edwin elias elisa elise eliza emilio esteban
eva fabio farah federico felix fiona florence francesca gabriela gerardo giovanni giuseppe gustavo hamza harold
heidi helena hiroshi hussein ibrahim ignacio igor ilya ines ingrid irina isaac ivan ivana jacques jamal jan
janine javed jia joana joaquin jonas josefina julian juliana karim karina karl katarzyna kenji khalid kiran
kristina lars laszlo leila leon leticia lidia liliana lorena lorenzo luca luciana lucia ludmila magdalena
mahmoud malik manoj marcela marek margarita mariana marina marta martina mateusz maurice maya mehmet milan
mirela miriam moises monika nadia natalia neha nikolai nina noah norma olga oliver omar pavel petra pierre pilar
piotr pooja rajiv ramiro rana rania raquel rashid renata ricky rita rodrigo rohan roman rosario ruby sabrina
sanjay santos sasha sebastian sergei silvia simon sofia sonia stefan sven tamara tatiana teodoro theresa tomas
valentina valeria vanessa vera vikram viktor vladimir wendy yasmin yuki yuri yusuf zainab zoe
""".split())

NAME_PARTICLES = frozenset("de da del della der di do dos du la le van von y bin bint al el ibn ben st".split())
NAME_SUFFIXES = frozenset("jr sr ii iii iv".split())

# Capitalised words an abstract may keep. Lowercase. Never names: legal and
# government vocabulary, sentence openers, months, and the places and
# nationalities these opinions mention.
VOCAB = frozenset("""
a an the and or but nor so yet for of in on at to by with from into onto upon over under after before
because since although though while when where whether if unless until than then thus here there this
that these those such each every any all both either neither some many most more much other another
same it its he she they them their his her him hers we our us you your i my me who whom whose which what
why how not no yes also only even just still however moreover further furthermore therefore accordingly
indeed finally first second third fourth next last now later once again as see id ibid cf e.g i.e
during despite following without within instead given specifically separately similarly nonetheless
nevertheless ultimately meanwhile likewise rather notably importantly applying taking having pursuant
through between among regarding concerning absent several one two three four five six seven eight nine
ten one's because respectfully thereafter thereby whereas wherefore background facts discussion analysis
conclusion introduction legal standard mr ms mrs miss dr mx standards history procedural factual statutory regulatory overview
plaintiff plaintiffs defendant defendants petitioner petitioners respondent respondents appellant appellants
appellee appellees applicant applicants employer employers employee employees alien aliens beneficiary
beneficiaries government court courts judge judges board panel majority dissent concurrence opinion order
orders memorandum motion motions complaint compl am amended answer brief reply opp mem ecf dkt doc ex exh
exhibit exhibits app appx record rec car admin tr transcript section sections subsection part parts rule
rules regulation regulations statute statutes act acts code title chapter paragraph clause article
amendment constitution constitutional federal national state states united america american u.s usa
department secretary attorney general office officer officers director administrator administration agency
agencies bureau service services commission council committee congress senate house president presidential
proclamation executive embassy consulate consular immigration immigrant immigrants nonimmigrant
nationality citizenship customs border protection enforcement homeland security labor labour wage hour
foreign certification certifying employment training program programs visa visas petition petitions form
forms worker workers work permanent residence resident residents status adjustment application
applications approval approved denial denied decision decisions determination prevailing
procedure procedures administrative review mandamus relief injunction preliminary summary judgment
dismiss dismissal standing jurisdiction claim claims count counts cause action actions case cases matter
apa ina cfr fr usc u.s.c c.f.r f.r fed reg supp cir circuit district supreme appeals appeal bia aao uscis dhs dol eta
oflc whd doj cbp ice nvc kcc fam fbi dos dept dep't eb perm lca pwd rfe rfi noid specialty occupation
lottery registration cap selection selected certified based bulletin unlawful delay unreasonable unreasonably delayed
january february march april may june july august september october november december jan feb mar apr jun
jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday
iran iranian india indian china chinese mexico mexican russia russian ukraine ukrainian brazil brazilian
canada canadian philippines filipino guatemala guatemalan honduras honduran salvador salvadoran venezuela
venezuelan cuba cuban nigeria nigerian pakistan pakistani afghanistan afghan turkey turkish korea korean
vietnam vietnamese japan japanese israel israeli syria syrian iraq iraqi egypt egyptian lebanon lebanese
yemen yemeni jordan jordanian saudi arabia arabian emirates kenya kenyan ghana ghanaian ethiopia ethiopian
bangladesh bangladeshi nepal nepali colombia colombian peru peruvian haiti haitian dominican jamaica
jamaican taiwan taiwanese europe european africa african asia asian armenia armenian belarus kazakhstan
uzbekistan libya libyan somalia somali sudan sudanese tehran abu dhabi dubai ankara istanbul moscow yerevan
new york washington d.c california texas florida virginia maryland illinois massachusetts michigan ohio
pennsylvania jersey carolina arizona colorado minnesota missouri tennessee kentucky louisiana alabama
mississippi oklahoma oregon nevada utah iowa kansas nebraska idaho montana wyoming dakota alaska hawaii
maine vermont hampshire connecticut delaware wisconsin indiana arkansas columbia guam rico puerto islands
island north south east west northern southern eastern western central
""".split())

HONORIFIC = re.compile(r"\b(Mr|Ms|Mrs|Miss|Dr|Mx)\.?\s+((?:[A-Z][A-Za-z'’\-]+\s+){0,2}[A-Z][A-Za-z'’\-]+)")
SPLIT_V = re.compile(r"\s+(?:v\.|vs\.|versus|v)\s+", re.I)
PREFIX = re.compile(r"^(In re|In the Matter of|Matter of|Ex parte|Petition of|Application of|Estate of)\s+", re.I)
ET_AL = re.compile(r",?\s+et\s+al\.?\s*$", re.I)
DBA = re.compile(r"\s*,?\s+(?:d/b/a|dba:?|d\.b\.a\.|a/k/a|aka)\s+", re.I)
INITIALS = re.compile(r"^(?:[A-Z]\.){1,5}$")
NAME_TOKEN = re.compile(r"^[A-Z][A-Za-z'’\-]*\.?$")


@dataclass
class Caption:
    """A caption after the rule. `text` is what the page may print; `held`
    says why it can't be printed (None when it can). `people` are the names
    that became initials, for the abstract; `orgs` are words it may keep."""
    text: str
    held: str | None
    people: list[str] = field(default_factory=list)
    orgs: set[str] = field(default_factory=set)


def _words(party: str) -> list[str]:
    return [w for w in re.split(r"[\s,;:()/]+", party) if w]


def _bare(w: str) -> str:
    b = w.lower().replace("’", "'").strip(".'")
    return re.sub(r"'s$", "", b)


def initials(name: str) -> str:
    """'Khaboshan' to 'K.', 'Philip Johnson' to 'P.J.', 'Luis Gomez-Echeverria'
    to 'L.G.'. Particles and suffixes are left out."""
    out = []
    for w in _words(name):
        b = _bare(w)
        if b in NAME_PARTICLES or b in NAME_SUFFIXES or b == "the" or not w[:1].isalpha() or w[:1].islower():
            continue
        out.append(w[0].upper() + ".")
    return "".join(out) or "X."


def people_initials(part: str) -> str:
    """Initials for each person in "A and B" ("E. and T.")."""
    return " and ".join(initials(x) for x in re.split(r"\s+(?:and|&)\s+", part.strip()))


def is_official(party: str, year: int | None, position: int) -> bool:
    w = _words(party)
    if len(w) != 1 or year is None:
        return False
    key = _bare(w[0])
    terms = OFFICIALS.get(key)
    if not terms or (key in COMMON_OFFICIAL_SURNAMES and position == 0):
        return False
    return any(start <= year <= (9999 if end is None else end + 3) for start, end in terms)


def is_organization(party: str) -> bool:
    if AGENCY_PHRASES.search(party) or "&" in party or re.search(r"[A-Za-z]['’]s\b", party):
        return True
    if re.search(r"\.(com|org|net|io)\b", party, re.I):
        return True
    words = [x for w in _words(party) for x in [w, *w.split("-")] if x]
    return any(_bare(w) in ORG_WORDS for w in words)


def classify(party: str, *, context: str, year: int | None, position: int) -> tuple[str, str]:
    """(kind, printed) for one party: kind is keep, person or unknown."""
    p = party.strip().strip(",").strip()
    if not p:
        return "unknown", p
    if INITIALS.match(p.replace(" ", "")) or _bare(p) in PSEUDONYMS or re.fullmatch(
            r"(John|Jane|Richard|Mary) (Doe|Roe)( \d+)?", p, re.I):
        return "keep", p
    if is_organization(p) or is_official(p, year, position):
        return "keep", p
    words = _words(p)
    namey = all(NAME_TOKEN.match(w) or _bare(w) in NAME_PARTICLES or _bare(w) in NAME_SUFFIXES for w in words)
    if not namey or len(words) > 5 or re.search(r"\d", p) or " and " in f" {p.lower()} ":
        return "unknown", p
    if context == "court":
        return "person", initials(p)
    # An employer caption: a person only when it opens with a given name.
    if len(words) >= 2 and _bare(words[0]) in GIVEN_NAMES:
        return "person", initials(p)
    return "unknown", p


def caption_rule(caption: str, *, context: str, year: int | None, ruling: str | None = None) -> Caption:
    """Apply the rule to a whole caption. `context` is "court" or "employer".
    `ruling` is a person's decision on a held caption (`person` or
    `organization`) and settles every party the rule couldn't."""
    text = " ".join((caption or "").split())
    cap = Caption(text="", held=None)
    m = PREFIX.match(text)
    prefix = m.group(0) if m else ""
    body = text[len(prefix):]
    out_sides = []
    for pos, side in enumerate(SPLIT_V.split(body)):
        side_etal = ""
        sm = ET_AL.search(side)
        if sm:
            side_etal, side = " et al.", side[: sm.start()]
        names = DBA.split(side)
        printed = []
        for i, part in enumerate(names):
            kind, shown = classify(part, context=context, year=year, position=pos)
            if i > 0 and kind != "keep":
                # "X d/b/a Y": the business named after d/b/a is printed as
                # it's registered; the person before it is not.
                kind, shown = "keep", part.strip()
            if kind == "unknown" and ruling:
                kind = "person" if ruling == "person" else "keep"
                shown = people_initials(part) if kind == "person" else part.strip()
            if kind == "unknown":
                cap.held = cap.held or f"can't tell whether {part.strip()!r} is a person or an organization"
            elif kind == "person":
                cap.people.append(part.strip())
            else:
                cap.orgs.update(_bare(w) for w in _words(part))
            printed.append(shown)
        out_sides.append(" d/b/a ".join(printed) + side_etal)
    cap.text = prefix + " v. ".join(out_sides)
    return cap


def _drop_given(prefix_words: str) -> str:
    """Of up to two capitalised words before a name, keep the ones up to the
    last that is vocabulary ("Plaintiff"); the rest are given names."""
    words = prefix_words.split()
    keep = 0
    for i, w in enumerate(words):
        if _bare(w) in VOCAB:
            keep = i + 1
    return " ".join(words[:keep]) + (" " if keep else "")


def redact_text(text: str | None, people: list[str]) -> str | None:
    """`text` with the caption's people as their initials (a first name the
    caption left off included) and every honorific name ("Ms. Smith") as the
    honorific and initials."""
    if not text:
        return text
    out = text
    for person in sorted(people, key=len, reverse=True):
        words = [w for w in _words(person) if _bare(w) not in NAME_PARTICLES | NAME_SUFFIXES]
        if not words:
            continue
        ini = initials(person)
        whole = r"\s+".join(re.escape(w) for w in words)
        out = re.sub(rf"((?:\b[A-Z][a-z'’\-]+\s+){{0,2}})\b{whole}\b", lambda m: _drop_given(m.group(1)) + ini, out)
        for w in words:
            if len(w) > 1:
                out = re.sub(rf"((?:\b[A-Z][a-z'’\-]+\s+)?)\b{re.escape(w)}\b",
                             lambda m: _drop_given(m.group(1)) + ini, out)
    return HONORIFIC.sub(lambda m: f"{m.group(1)}. {initials(m.group(2))}", out)


def residual_names(text: str | None, allowed: set[str] | None = None, *, exempt_first: bool = False) -> list[str]:
    """Capitalised words in `text` that aren't vocabulary, the caption's
    organizations, initials, acronyms or form numbers: what might be a name.
    `exempt_first` lets the text's first word through: an OALJ headnote opens
    with its topic ("Actual minimum requirements ..."), never a name."""
    if not text:
        return []
    allowed = allowed or set()
    left = []
    for n, w in enumerate(re.findall(r"[A-Za-z][A-Za-z'’\-\.]*", text)):
        if not w[0].isupper() or (exempt_first and n == 0):
            continue
        b = _bare(w)
        parts = [x for x in b.split("-") if x]
        known = lambda x: x in VOCAB or x in allowed or (x.endswith("s") and x[:-1] in VOCAB)  # noqa: E731
        if INITIALS.match(w) or re.fullmatch(r"(?:[A-Z]\.)+['’]s", w):  # "K." or "K.’s"
            continue
        if known(b) or (parts and all(known(x) for x in parts)):
            continue
        if w.rstrip(".").isupper() and len(w.rstrip(".")) <= 6:  # ECF, USCIS, CFR
            continue
        if re.fullmatch(r"[A-Z]{1,3}-?\d+[A-Z]?\.?", w):  # I-140, H-1B, DS-160
            continue
        left.append(w)
    return left


def safe_abstract(text: str | None, cap: Caption, *, limit: int = 600,
                  exempt_first: bool = False) -> tuple[str | None, list[str]]:
    """The redacted text, or None and the words that made it unsafe."""
    if not text or not text.strip():
        return None, []
    red = " ".join(redact_text(text, cap.people).split())
    left = residual_names(red, cap.orgs, exempt_first=exempt_first)
    if left:
        return None, left
    if len(red) > limit:
        cut = red[:limit]
        red = cut[: cut.rfind(" ")].rstrip(" ,;:") + " ..."
    return red, []


# --------------------------------------------------------------------------
# The held list
# --------------------------------------------------------------------------

HELD_DDL = """CREATE TABLE IF NOT EXISTS policy_held (
    document_number TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    caption TEXT NOT NULL,
    reason TEXT NOT NULL,
    row_json TEXT NOT NULL,
    held_at INTEGER NOT NULL,
    decision TEXT,
    decided_at INTEGER)"""


def held_rows(db, source: str) -> dict[str, dict]:
    from lib_db import query_dicts  # late: keeps this module importable without a database
    db.execute(HELD_DDL)
    return {r["document_number"]: r for r in query_dicts(
        db, "SELECT document_number, caption, reason, row_json, decision FROM policy_held WHERE source = ?", [source])}


def hold(db, source: str, row: dict, caption: str, reason: str, *, now_ms: int | None = None) -> int:
    """Keep a row off the page until a person rules on its caption. Written
    only when new or changed, so an unchanged run writes nothing."""
    blob = json.dumps(row, sort_keys=True)
    prev = held_rows(db, source).get(row["document_number"])
    if prev and prev["caption"] == caption and prev["reason"] == reason and prev["row_json"] == blob:
        return 0
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    db.execute(
        "INSERT INTO policy_held (document_number, source, caption, reason, row_json, held_at) "
        "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(document_number) DO UPDATE SET caption = excluded.caption, "
        "reason = excluded.reason, row_json = excluded.row_json",
        [row["document_number"], source, caption, reason, blob, now])
    return 1


def rule_on(db, source: str, document_number: str, ruling: str, *, now_ms: int | None = None) -> dict | None:
    """Record a person's ruling on a held caption (`person` or
    `organization`); the held row, or None when nothing is held under it."""
    if ruling not in ("person", "organization"):
        raise ValueError("a ruling is person or organization")
    row = held_rows(db, source).get(document_number)
    if row is None:
        return None
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    db.execute("UPDATE policy_held SET decision = ?, decided_at = ? WHERE document_number = ?",
               [ruling, now, document_number])
    row["decision"] = ruling
    return row
