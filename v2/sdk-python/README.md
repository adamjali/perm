# permtracker

The [PERM Tracker](https://permtracker.app) API from Python and the command line: the Department of Labor's live status for any PERM, prevailing wage, H-1B LCA, H-2A, H-2B or CW-1 case, when a pending PERM case is likely to be decided, DOL's queue, visa bulletins, and employer, law firm and occupation records.

Free up to 3,000 calls a month; make a key at [permtracker.app/settings](https://permtracker.app/settings), under API keys. No dependencies; Python 3.9 or later.

```sh
pip install permtracker
permtracker login
permtracker case G-100-26045-123456
permtracker estimate --filed 2026-02-15 --json
```

```python
from permtracker import PermTracker, PermTrackerError

pt = PermTracker(api_key="pt_live_...")   # or set PERMTRACKER_API_KEY
answer = pt.case("G-100-26045-123456")
print(answer.data["status"], answer.meta.get("asOf"), answer.usage.today)
```

Every method returns an `Answer` with `data`, `meta` and `usage`. A refusal raises `PermTrackerError` with the API's `code`, message and `retry_after`. Reference: [permtracker.app/developers](https://permtracker.app/developers).
