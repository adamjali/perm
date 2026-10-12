#!/usr/bin/env python3
"""The daily disk copy (bin/permtracker-disk-copies): it deletes before it
makes, never holds more than the free five, never touches another disk's
copies, and says when a copy isn't free. Run: python3 scripts/oracle/test_disk_copies.py"""
import importlib.machinery
import importlib.util
import pathlib
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("pt_disk_copies", str(HERE / "bin" / "permtracker-disk-copies"))
spec = importlib.util.spec_from_loader("pt_disk_copies", loader)
dc = importlib.util.module_from_spec(spec)
loader.exec_module(dc)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


VOL = "ocid1.bootvolume.oc1.phx.this-disk"
OTHER = "ocid1.bootvolume.oc1.phx.another-disk"
NOW = datetime(2026, 10, 13, 6, 30, tzinfo=timezone.utc)
FREE = {"orcl-cloud": {"free-tier-retained": "true"}}


def copy(day: int, state: str = "AVAILABLE", vol: str = VOL, tags=FREE, hours_ago: float | None = None):
    made = NOW - timedelta(hours=hours_ago) if hours_ago is not None else datetime(2026, 10, day, 6, 0, tzinfo=timezone.utc)
    return NS(id=f"ocid1.bootvolumebackup.oc1.phx.{vol[-10:]}-{day}-{state}", display_name=f"copy Oct {day}",
              lifecycle_state=state, time_created=made, boot_volume_id=vol, system_tags=tags)


class FakeOracle:
    """Holds copies, records every call in order, and settles deletes and
    makes on the next read (Oracle's own pace doesn't matter to the rule)."""

    def __init__(self, copies, new_tags=FREE, page_size=100):
        self.copies = {c.id: c for c in copies}
        self.calls: list[tuple] = []
        self.new_tags = new_tags
        self.page_size = page_size

    def list_boot_volume_backups(self, compartment_id, boot_volume_id, page=None):
        self.calls.append(("list",))
        # A real filter, plus one copy of another disk slipped in to prove the
        # job checks the field itself.
        rows = [c for c in self.copies.values() if c.boot_volume_id == boot_volume_id or c.boot_volume_id == OTHER]
        start = int(page or 0)
        chunk = rows[start:start + self.page_size]
        nxt = str(start + self.page_size) if start + self.page_size < len(rows) else None
        return NS(data=chunk, next_page=nxt)

    def delete_boot_volume_backup(self, cid):
        self.calls.append(("delete", cid))
        if self.copies[cid].boot_volume_id != VOL:
            raise AssertionError("deleted another disk's copy")
        self.copies[cid].lifecycle_state = "TERMINATING"

    def get_boot_volume_backup(self, cid):
        c = self.copies[cid]
        if c.lifecycle_state == "TERMINATING":
            c.lifecycle_state = "TERMINATED"
        elif c.lifecycle_state == "CREATING":
            c.lifecycle_state = "AVAILABLE"
        return NS(data=c)

    def create_boot_volume_backup(self, details):
        live = [c for c in self.copies.values() if c.lifecycle_state not in dc.GONE and c.boot_volume_id == VOL]
        self.calls.append(("create", len(live)))
        new = NS(id="ocid1.bootvolumebackup.oc1.phx.new", display_name=details["name"], lifecycle_state="CREATING",
                 time_created=NOW, boot_volume_id=details["vid"], system_tags=self.new_tags)
        self.copies[new.id] = new
        return NS(data=new)


def details(vid, name):
    return {"vid": vid, "name": name}


def run(fake, **kw):
    tmp = pathlib.Path(tempfile.mkdtemp()) / "backups" / "DISKCOPY_OK"
    ticks = {"t": 0.0}

    def clock():  # every read moves the clock one poll, so waits end in steps, not real time
        ticks["t"] += dc.POLL_S
        return ticks["t"]

    code = dc.run(fake, "ocid1.tenancy.oc1..x", VOL, details, now=NOW, sleep=lambda s: None, clock=clock,
                  marker=tmp, **kw)
    return code, tmp


def deleted(fake):
    return [c[1] for c in fake.calls if c[0] == "delete"]


# --- plan: which copies go before a new one is made ---
five = [copy(d) for d in (4, 5, 6, 7, 8)]
todo, skip, problem = dc.plan(five, NOW.timestamp())
check("five held: the two oldest go, so the new one is the fourth",
      [c.display_name for c in todo] == ["copy Oct 4", "copy Oct 5"], str([c.display_name for c in todo]))
check("three held: nothing goes", dc.plan(five[2:], NOW.timestamp())[0] == [])
nine = [copy(d) for d in range(4, 13)]
check("nine held (Oct 12 2026): the six oldest go, the newest three stay",
      [c.display_name for c in dc.plan(nine, NOW.timestamp())[0]] == [f"copy Oct {d}" for d in range(4, 10)])
broken = [copy(10, "FAULTY")] + five[2:]
check("a broken copy goes before any good one",
      [c.lifecycle_state for c in dc.plan(broken, NOW.timestamp())[0]] == ["FAULTY"])
busy = five[:3] + [copy(12, "CREATING", hours_ago=1)]
todo, skip, problem = dc.plan(busy, NOW.timestamp())
check("a copy being made right now: the run steps aside, deleting nothing", todo == [] and skip and not problem)
stuck = five[:3] + [copy(12, "CREATING", hours_ago=9)]
todo, skip, problem = dc.plan(stuck, NOW.timestamp())
check("a copy stuck for nine hours is a problem, not a skip", todo == [] and problem and not skip)

# --- run: the order of calls, the count, the marker ---
fake = FakeOracle(five + [copy(9, vol=OTHER)])
code, marker = run(fake)
first_create = next(i for i, c in enumerate(fake.calls) if c[0] == "create")
last_delete = max(i for i, c in enumerate(fake.calls) if c[0] == "delete")
check("every delete finishes before the copy is made", last_delete < first_create)
check("the new copy is made with three held, so it's the fourth, never the sixth",
      fake.calls[first_create][1] == 3, str(fake.calls[first_create]))
check("the two oldest of this disk were deleted, nothing else",
      sorted(deleted(fake)) == sorted([five[0].id, five[1].id]), str(deleted(fake)))
check("another disk's copy is never touched", fake.copies[copy(9, vol=OTHER).id].lifecycle_state == "AVAILABLE")
check("a good run exits 0", code == 0)
check("the marker says when, how many and whether the new copy is free",
      marker.exists() and marker.read_text().split() == ["2026-10-13T06:30:00Z", "4", "yes"],
      marker.read_text() if marker.exists() else "no marker")

fake = FakeOracle(five)
code, marker = run(fake, dry_run=True)
check("a dry run deletes nothing and makes nothing", not any(c[0] in ("delete", "create") for c in fake.calls))
check("a dry run writes no marker", not marker.exists())

fake = FakeOracle(five, new_tags={"orcl-cloud": {"free-tier-retained": "false"}})
code, marker = run(fake)
check("a new copy Oracle doesn't mark free fails the run, so the alarm emails", code == 1)
check("and the marker says so", marker.exists() and marker.read_text().split()[2] == "no")

fake = FakeOracle(five, new_tags={})
code, marker = run(fake)
check("a copy with no tags at all reads as billed (how Oracle showed the billed ones)",
      code == 1 and marker.read_text().split()[2] == "no")

late = FakeOracle(five, new_tags={})
reads = {"n": 0}
real_get = late.get_boot_volume_backup


def get_tagged_later(cid):
    out = real_get(cid)
    if cid.endswith(".new"):
        reads["n"] += 1
        if reads["n"] >= 3:
            out.data.system_tags = FREE
    return out


late.get_boot_volume_backup = get_tagged_later
code, marker = run(late)
check("a tag Oracle adds a little after the copy is ready still counts", code == 0 and marker.read_text().split()[2] == "yes")

fake = FakeOracle([copy(d) for d in range(4, 13)], page_size=3)
code, _ = run(fake)
check("copies spread over several pages are all counted (nine held, six deleted)",
      len(deleted(fake)) == 6, str(len(deleted(fake))))

fake = FakeOracle(five[:3] + [copy(12, "CREATING", hours_ago=9)])
code, marker = run(fake)
check("a stuck copy fails the run and changes nothing",
      code == 1 and not marker.exists() and not any(c[0] in ("delete", "create") for c in fake.calls))

# --- wait_for ---
gone = NS(status=404)


class NotFound(Exception):
    status = 404


def missing(_cid):
    raise NotFound()


check("a copy that no longer exists counts as deleted",
      dc.wait_for(missing, "x", {"TERMINATED"}, 60, sleep=lambda s: None) == "TERMINATED")
ticks = iter(range(0, 10_000, 600))
try:
    dc.wait_for(lambda cid: NS(data=NS(lifecycle_state="CREATING")), "x", {"AVAILABLE"}, 3600,
                sleep=lambda s: None, clock=lambda: next(ticks))
    check("a copy that never finishes times out", False)
except TimeoutError:
    check("a copy that never finishes times out", True)
try:
    dc.wait_for(lambda cid: NS(data=NS(lifecycle_state="FAULTY")), "x", {"AVAILABLE"}, 3600, sleep=lambda s: None)
    check("a copy Oracle marks faulty stops the wait", False)
except RuntimeError:
    check("a copy Oracle marks faulty stops the wait", True)

# --- free_tagged ---
check("Oracle's free-tier tag reads as free", dc.free_tagged(NS(system_tags=FREE)) is True)
check("tags without it read as billed", dc.free_tagged(NS(system_tags={"orcl-cloud": {}})) is False)
check("no tags read as billed", dc.free_tagged(NS(system_tags={})) is False)
check("missing system_tags read as billed", dc.free_tagged(NS(system_tags=None)) is False)

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
