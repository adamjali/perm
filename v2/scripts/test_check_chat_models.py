#!/usr/bin/env python3
"""Gates for check_chat_models.py: it reads the chain the chat really uses, and
it reads each provider's answer the way the Oct 12 and Oct 29 2026 failures
looked."""
from __future__ import annotations

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import check_chat_models as C  # noqa: E402

fails: list[str] = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


# ── the ids come from the code itself ──
models = C.models_in_use()
chat = [m for m in models if m["role"] == "chat"]
summary = [m for m in models if m["role"] == "summary"]
providers_ts = (C.V2 / "src/lib/ai/providers.ts").read_text()
check(len(chat) >= 4, f"the chat's chain is read from providers.ts ({len(chat)} models)")
check(all(f"'{m['id']}'" in providers_ts for m in chat), "every id read is in providers.ts as written")
check(chat[0]["provider"] == "google", "the chain is read in order: Gemini leads it")
check(all(m["name"] != m["id"] for m in chat), "each chat model carries its display name")
gpt = next((m for m in chat if m["id"] == "openai/gpt-oss-120b"), None)
check(gpt is not None and gpt["name"] == "GPT-OSS 120B (Groq)", "a name on the line after its model is still found")
check(any(m["id"] == "openai/gpt-oss-20b" for m in summary), "the summarizer's own model is asked too")
check(len({(m["provider"], m["id"]) for m in models}) == len(models), "a model both use is asked once")
# Every SDK call in the chain block is found: count them independently.
block = providers_ts[providers_ts.find("const MODEL_CONFIGS"):]
block = block[:block.find("];")]
check(len(C.CALL_RE.findall(block)) == len(chat), "no model call in MODEL_CONFIGS is missed")

fixture = """const MODEL_CONFIGS: ModelConfig[] = [
  { model: google('a-1'), name: 'A one' },
  {
    model: groq('b/2'),
    name: 'B two',
  },
];
const other = google('not-in-the-chain');"""
got = C.chat_chain(fixture)
check([(m["id"], m["name"]) for m in got] == [("a-1", "A one"), ("b/2", "B two")],
      "a fixture chain reads in order with its names, and nothing outside the array")

# ── keys are read by name and never invented ──
with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as f:
    f.write("GROQ_API_KEY=gk\nOTHER_SECRET=nope\nMISTRAL_API_KEY='mk'\n")
keys = C.read_keys(f.name, {"groq": "GROQ_API_KEY", "mistral": "MISTRAL_API_KEY", "google": "NOT_SET_ANYWHERE_X"})
check(keys == {"groq": "gk", "mistral": "mk", "google": ""}, "keys come from the file by name; quotes stripped")
pathlib.Path(f.name).unlink()

# ── each failure seen in practice gets the right verdict ──
V = C.classify
check(V(True, True, 200, "", {})[0] == "ok", "a 200 is ok")
check(V(False, True, 0, "", {})[0] == "gone", "an id the provider no longer lists is gone (Oct 12 Gemini 2.0)")
check(V(True, True, 404, '{"error":"model not found"}', {})[0] == "gone", "a 404 is gone")
mistral = V(True, True, 429, "", {"X-RateLimit-Limit-Req-Minute": "0"})
check(mistral == ("refused", "the account allows 0 requests a minute"), "Mistral's 0-a-minute account is refused (Oct 29)")
check(V(True, True, 429, "", {"x-ratelimit-limit-req-minute": "60"})[0] == "busy", "an ordinary 429 is busy, asked again tomorrow")
check(V(True, True, 429, "RESOURCE_EXHAUSTED: quota", {})[0] == "busy", "Gemini's spent free allowance is busy, not gone")
orr = V(True, True, 404, "No endpoints found matching your data policy (Free model training)", {})
check(orr[0] == "refused" and "training" in orr[1], "OpenRouter's data-policy 404 is refused, with the setting named (Oct 29)")
check(V(True, True, 402, "", {})[0] == "refused", "a payment wall is refused (Cerebras, Oct 12)")
check(V(True, True, 401, "", {})[0] == "refused", "a bad key is refused")
check(V(True, False, 200, "", {})[0] == "unfit", "a model listed without tool calls is unfit")
check(V(True, True, 0, "", {})[0] == "busy", "no answer is busy")
check(V(True, True, 503, "", {})[0] == "busy", "a 5xx is the provider's, busy")
check(V(None, True, 200, "", {})[0] == "ok", "an unread model list doesn't stop a model that answers")
check(all(V(*a)[0] in C.VERDICTS for a in [(True, True, s, "", {}) for s in (0, 200, 400, 401, 402, 404, 429, 500)]),
      "every verdict is one the report knows")

# ── the run's outcome ──
r = lambda role, v, name="m": {"role": role, "verdict": v, "name": name}  # noqa: E731
alive, note = C.summarize([r("chat", "ok"), r("chat", "refused", "Mistral Small"), r("summary", "ok")])
check(alive and "1 of 2 chat models answered" in note and "Mistral Small: refused" in note,
      "one model refused with another answering keeps the chat alive and names it")
check(not C.summarize([r("chat", "gone"), r("chat", "busy"), r("summary", "ok")])[0],
      "no chat model answering is the alarm, even when the summarizer answers")

# A model without its key is refused by name, and nothing is sent for it.
sent: list = []
orig_list, orig_ask = C.listed_ids, C.ask
C.listed_ids = lambda p, k: ({"x": True}, "")
C.ask = lambda p, m, k: sent.append(m) or (200, "", {})
try:
    out = C.check_all([{"provider": "groq", "id": "x", "role": "chat", "name": "X"},
                       {"provider": "mistral", "id": "y", "role": "chat", "name": "Y"}],
                      {"groq": "gk", "mistral": ""})
finally:
    C.listed_ids, C.ask = orig_list, orig_ask
check(out[0]["verdict"] == "ok" and out[1]["verdict"] == "refused" and "MISTRAL_API_KEY" in out[1]["reason"],
      "a missing key is refused by its name")
check(sent == ["x"], "nothing is sent for a model without a key")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
