# permtracker

The [PERM Tracker](https://permtracker.app) API from Python and the command line: the Department of Labor's live status for any PERM, prevailing wage, H-1B LCA, H-2A, H-2B or CW-1 case, when a pending PERM case is likely to be decided, DOL's queue, visa bulletins, and employer, law firm and occupation records.

Make a key at [permtracker.app/settings](https://permtracker.app/settings), under API keys. Paid features (exports, live DOL lookups, webhooks, the higher limits) are free for every account until billing opens. A `pt_test_` sandbox key answers fixed sample data and isn't counted. No dependencies; Python 3.9 or later.

```sh
pip install permtracker
permtracker login
permtracker case G-100-26045-123456
permtracker estimate --filed 2026-02-15 --json
permtracker case G-100-26045-123456 --live        # ask DOL now if we don't hold it yet
permtracker export cases q=acme state=CA > acme.csv
permtracker webhooks add https://example.com/hooks case.status_changed
permtracker watch G-100-26045-123456
```

```python
from permtracker import PermTracker, PermTrackerError

pt = PermTracker(api_key="pt_live_...")   # or set PERMTRACKER_API_KEY
answer = pt.case("G-100-26045-123456")
print(answer.data["status"], answer.meta.get("asOf"), answer.usage.today)
```

Exports, webhooks and checking a delivery:

```python
from permtracker import verify_webhook

rows = pt.export_csv("cases", {"q": "acme", "state": "CA"}).csv
secret = pt.create_webhook("https://example.com/hooks", ["case.status_changed"]).data["secret"]  # shown once
pt.watch(case_number="G-100-26045-123456")

# in your handler, with the raw request body:
if not verify_webhook(secret, request.headers, request.get_data()):
    abort(400)
```

Every method returns an `Answer` with `data`, `meta` and `usage`. A refusal raises `PermTrackerError` with the API's `code`, message and `retry_after`. Reference: [permtracker.app/developers](https://permtracker.app/developers).
