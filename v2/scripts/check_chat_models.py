#!/usr/bin/env python3
"""Asks every AI model the site's chat and summarizer use whether it still answers.

The chat runs on free models, and free models retire or get refused without
notice. On Oct 12 2026 three of five were gone and every reply failed; on Oct 29
OpenRouter's free Nemotron 3 Super had retired and Mistral's free account was
allowing 0 requests a minute. Each time the chat's fallback hid it until a
person noticed.

Once a day, on the server (permtracker-uscis chat-models), this:
  1. reads the model ids from the code that uses them (src/lib/ai/providers.ts
     and summarize.ts), so the list can't drift from the chain;
  2. asks each provider's own model list whether the id is still offered (and,
     for OpenRouter, still takes tool calls, which the chat needs);
  3. sends each model one tiny request ("Reply with OK.", a few tokens);
  4. writes perm_docs['chat_models'] with a verdict per model, which the morning
     report reads ("The chat's AI models").

Verdicts: ok, gone (retired or no longer listed), refused (the account or key
is turned away: a 0-a-minute limit, a payment wall, a data-policy setting),
unfit (listed, but no longer offers what the chat needs), busy (a rate limit or
the provider's own error today; asked again tomorrow).

It exits 1, so the server's alarm emails the owner, only when no chat model
answered at all or the check itself couldn't run. One model gone with others
answering is a warning in the morning report: the chat still works.

The keys are read from the app's own environment file by name and never
printed. Run by hand: python3 scripts/check_chat_models.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
V2 = HERE.parent
sys.path.insert(0, str(HERE))

DOC_KEY = "chat_models"
SCRIPT = "check_chat_models.py"
KEYS_FILE = "/srv/permtracker/app/env/production.env"
KEY_NAMES = {
    "google": "GOOGLE_GENERATIVE_AI_API_KEY",
    "groq": "GROQ_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}
SOURCES = {
    "chat": V2 / "src/lib/ai/providers.ts",
    "summary": V2 / "src/lib/ai/summarize.ts",
}
# Groq refuses Python's default User-Agent (403), as Cloudflare-fronted hosts do.
USER_AGENT = "PERMTracker/1.0 (+https://permtracker.app; support@permtracker.app)"
PROMPT = "Reply with the word OK."
MAX_TOKENS = 16
TIMEOUT_S = 45
# OpenRouter's full model list is several megabytes (it was cut off at 200 KB, Oct 29 2026).
MAX_BODY = 30_000_000
VERDICTS = ("ok", "gone", "refused", "unfit", "busy")

CALL_RE = re.compile(r"\b(google|groq|mistral|openrouter)\(\s*['\"]([^'\"]+)['\"]\s*\)")
NAME_RE = re.compile(r"\bname:\s*['\"]([^'\"]+)['\"]")


# ── what the code uses ──────────────────────────────────────────────────


def chat_chain(text: str) -> list[dict]:
    """The chat's fallback chain, in order, from providers.ts's MODEL_CONFIGS."""
    start = text.find("const MODEL_CONFIGS")
    if start < 0:
        return []
    end = text.find("];", start)
    block = text[start:end if end > 0 else None]
    out: list[dict] = []
    # Each entry runs from one model call to the next; its name sits inside it.
    calls = list(CALL_RE.finditer(block))
    for i, m in enumerate(calls):
        stop = calls[i + 1].start() if i + 1 < len(calls) else len(block)
        name = NAME_RE.search(block, m.end(), stop)
        out.append({"provider": m.group(1), "id": m.group(2), "role": "chat",
                    "name": name.group(1) if name else m.group(2)})
    return out


def summary_models(text: str) -> list[dict]:
    """Every model the conversation summarizer calls."""
    return [{"provider": m.group(1), "id": m.group(2), "role": "summary", "name": m.group(2)}
            for m in CALL_RE.finditer(text)]


def models_in_use(sources: dict[str, pathlib.Path] = SOURCES) -> list[dict]:
    """The chat's chain, then the summarizer's models; a model both use is asked once."""
    chat = chat_chain(sources["chat"].read_text())
    summary = summary_models(sources["summary"].read_text())
    seen = {(m["provider"], m["id"]) for m in chat}
    return chat + [m for m in summary if (m["provider"], m["id"]) not in seen]


def read_keys(path: str, names: dict[str, str] = KEY_NAMES) -> dict[str, str]:
    """Each provider's key from the env file, by name only; the process
    environment fills any the file lacks (a run by hand)."""
    found: dict[str, str] = {}
    wanted = set(names.values())
    try:
        for line in pathlib.Path(path).read_text().splitlines():
            k, sep, v = line.strip().partition("=")
            if sep and k in wanted and v:
                found[k] = v.strip().strip("'\"")
    except OSError:
        pass
    return {p: found.get(n) or os.environ.get(n, "") for p, n in names.items()}


# ── what each provider says ─────────────────────────────────────────────


def classify(listed: bool | None, fit: bool, status: int, body: str, headers: dict[str, str]) -> tuple[str, str]:
    """Pure: one model's verdict and reason from what its provider answered.

    listed: whether the provider's own model list offers the id (None: the list
    couldn't be read). fit: whether it still offers what the chat needs.
    status: the tiny request's HTTP status (0 for no answer)."""
    text = (body or "").lower()
    h = {k.lower(): v for k, v in headers.items()}
    if listed is False:
        return "gone", "no longer in the provider's model list"
    if not fit:
        return "unfit", "listed, but no longer takes tool calls"
    if status == 200:
        return "ok", "answered"
    if status in (404, 410):
        if "data policy" in text or "privacy" in text or "training" in text:
            return "refused", ("served only with free-model training allowed in the account's privacy "
                               "settings")
        return "gone", f"the provider answered {status} for this model"
    if status == 402:
        return "refused", "the provider wants payment for this model (402)"
    if status in (401, 403):
        return "refused", f"the key was refused ({status})"
    if status == 429:
        limit = h.get("x-ratelimit-limit-req-minute") or h.get("x-ratelimit-limit-requests")
        if limit is not None and limit.strip() == "0":
            return "refused", "the account allows 0 requests a minute"
        if "quota" in text or "resource_exhausted" in text:
            return "busy", "today's free allowance is spent (429)"
        return "busy", "rate limited (429)"
    if status == 0:
        return "busy", "no answer (timed out or the connection failed)"
    if status >= 500:
        return "busy", f"an error on the provider's side ({status})"
    return "refused", f"the request was turned away ({status})"


def _http(url: str, *, key_header: dict[str, str], body: dict | None = None) -> tuple[int, str, dict[str, str]]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if body is not None else "GET",
                                 headers={"User-Agent": USER_AGENT, "Accept": "application/json",
                                          **({"Content-Type": "application/json"} if body is not None else {}),
                                          **key_header})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            return r.status, r.read(MAX_BODY).decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(20_000).decode("utf-8", "replace"), dict(e.headers or {})
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, "", {}


def auth(provider: str, key: str) -> dict[str, str]:
    if not key:
        return {}
    return {"x-goog-api-key": key} if provider == "google" else {"Authorization": f"Bearer {key}"}


def listed_ids(provider: str, key: str) -> tuple[dict[str, bool] | None, str]:
    """The ids the provider offers, each with whether it fits the chat's needs,
    or None and the reason when the list couldn't be read."""
    h = auth(provider, key)
    if provider == "google":
        out: dict[str, bool] = {}
        token = ""
        for _ in range(10):
            url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000" + (
                f"&pageToken={token}" if token else "")
            status, text, _hd = _http(url, key_header=h)
            if status != 200:
                return None, f"model list {status}"
            try:
                doc = json.loads(text)
            except ValueError:
                return None, "model list unreadable"
            for m in doc.get("models") or []:
                out[str(m.get("name", "")).removeprefix("models/")] = "generateContent" in (
                    m.get("supportedGenerationMethods") or [])
            token = doc.get("nextPageToken") or ""
            if not token:
                break
        return out, ""
    url = {"groq": "https://api.groq.com/openai/v1/models",
           "mistral": "https://api.mistral.ai/v1/models",
           "openrouter": "https://openrouter.ai/api/v1/models"}[provider]
    status, text, _hd = _http(url, key_header=h)
    if status != 200:
        return None, f"model list {status}"
    try:
        data = json.loads(text).get("data") or []
    except (ValueError, AttributeError):
        return None, "model list unreadable"
    out = {}
    for m in data:
        fit = True
        if provider == "openrouter":
            fit = "tools" in (m.get("supported_parameters") or [])
        out[str(m.get("id"))] = fit
        for alias in m.get("aliases") or []:
            out[str(alias)] = fit
    return out, ""


def ask(provider: str, model: str, key: str) -> tuple[int, str, dict[str, str]]:
    """One tiny request, the cheapest that proves the model answers."""
    h = auth(provider, key)
    if provider == "google":
        return _http(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                     key_header=h, body={"contents": [{"parts": [{"text": PROMPT}]}],
                                         "generationConfig": {"maxOutputTokens": MAX_TOKENS}})
    url = {"groq": "https://api.groq.com/openai/v1/chat/completions",
           "mistral": "https://api.mistral.ai/v1/chat/completions",
           "openrouter": "https://openrouter.ai/api/v1/chat/completions"}[provider]
    body = {"model": model, "messages": [{"role": "user", "content": PROMPT}], "max_tokens": MAX_TOKENS}
    if provider == "groq":
        body = {**{k: v for k, v in body.items() if k != "max_tokens"}, "max_completion_tokens": MAX_TOKENS}
    return _http(url, key_header=h, body=body)


def check_all(models: list[dict], keys: dict[str, str]) -> list[dict]:
    lists: dict[str, tuple[dict[str, bool] | None, str]] = {}
    out = []
    for m in models:
        p = m["provider"]
        if not keys.get(p):
            out.append({**m, "verdict": "refused", "reason": f"no {KEY_NAMES[p]} on the server"})
            continue
        if p not in lists:
            lists[p] = listed_ids(p, keys[p])
        ids, why = lists[p]
        listed = None if ids is None else m["id"] in ids
        fit = True if ids is None or not listed else ids[m["id"]]
        if listed is False or not fit:
            verdict, reason = classify(listed, fit, 0, "", {})
        else:
            status, text, headers = ask(p, m["id"], keys[p])
            verdict, reason = classify(listed, fit, status, text, headers)
            if ids is None and why:
                reason += f" (the model list couldn't be read: {why})"
        out.append({**m, "verdict": verdict, "reason": reason})
    return out


def summarize(results: list[dict]) -> tuple[bool, str]:
    """Whether the chat still has a model that answers, and the run's note."""
    chat = [r for r in results if r["role"] == "chat"]
    ok = [r for r in chat if r["verdict"] == "ok"]
    bad = [r for r in results if r["verdict"] in ("gone", "refused", "unfit")]
    note = f"{len(ok)} of {len(chat)} chat models answered"
    if bad:
        note += "; " + "; ".join(f"{r['name']}: {r['verdict']}" for r in bad)
    return bool(ok), note


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true", help="print the verdicts, write nothing")
    ap.add_argument("--keys-file", default=os.environ.get("CHAT_KEYS_FILE", KEYS_FILE))
    args = ap.parse_args()
    started = time.time()
    models = models_in_use()
    if not models:
        print("couldn't read the model ids from providers.ts", file=sys.stderr)
        if not args.dry_run:
            _record("failed", "couldn't read the model ids from providers.ts", started)
        return 1
    results = check_all(models, read_keys(args.keys_file))
    alive, note = summarize(results)
    # Names and verdicts only: the run's log is read by people, never a key.
    for r in results:
        print(f"{r['verdict']:8} {r['role']:8} {r['name']}: {r['reason']}")
    if args.dry_run:
        return 0 if alive else 1
    from lib_db import Database, write_doc  # noqa: PLC0415

    doc = {"checkedAt": int(time.time() * 1000), "models": results}
    try:
        write_doc(Database(), DOC_KEY, doc)
    except Exception as e:  # noqa: BLE001
        print(f"couldn't store the verdicts ({type(e).__name__})", file=sys.stderr)
        _record("failed", f"couldn't store the verdicts ({type(e).__name__})", started)
        return 1
    _record("ok" if alive else "failed", note if alive else "no chat model answered: " + note, started)
    return 0 if alive else 1


def _record(status: str, note: str, started: float) -> None:
    try:
        from lib_db import Database, record_run  # noqa: PLC0415

        record_run(Database(), SCRIPT, status=status, note=note, started_at=started)
    except Exception:  # noqa: BLE001
        print("couldn't record the run", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
