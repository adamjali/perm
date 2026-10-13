#!/usr/bin/env python3
"""The nightly disk-copy check (bin/permtracker-disk-copies): Oracle's schedule
makes the copy, and this job checks last night's is there and free, deletes
down to three, billed copies first, never makes one, never touches another
disk's copies. Run: python3 scripts/oracle/test_disk_copies.py"""
import contextlib
import io
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


LOG = {"text": ""}


def run(fake, **kw):
    tmp = pathlib.Path(tempfile.mkdtemp()) / "backups" / "DISKCOPY_OK"
    ticks = {"t": 0.0}

    def clock():  # every read moves the clock one poll, so waits end in steps, not real time
        ticks["t"] += dc.POLL_S
        return ticks["t"]

    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = dc.run(fake, "ocid1.tenancy.oc1..x", VOL, now=NOW, sleep=lambda s: None, clock=clock,
                      marker=tmp, **kw)
    LOG["text"] = out.getvalue()
    return code, tmp


def creates(fake):
    return [c for c in fake.calls if c[0] == "create"]


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
billed = {"orcl-cloud": {}}
mixed = [copy(6), copy(7), copy(8), copy(13, tags=billed)]
check("a billed copy goes before older free ones",
      [c.display_name for c in dc.plan(mixed, NOW.timestamp())[0]] == ["copy Oct 13"],
      str([c.display_name for c in dc.plan(mixed, NOW.timestamp())[0]]))
broken = [copy(10, "FAULTY")] + five[2:]
check("a broken copy goes before any good one",
      [c.lifecycle_state for c in dc.plan(broken, NOW.timestamp())[0]] == ["FAULTY"])
busy = five[:3] + [copy(12, "CREATING", hours_ago=1)]
todo, skip, problem = dc.plan(busy, NOW.timestamp())
check("a copy being made right now: the run steps aside, deleting nothing", todo == [] and skip and not problem)
stuck = five[:3] + [copy(12, "CREATING", hours_ago=9)]
todo, skip, problem = dc.plan(stuck, NOW.timestamp())
check("a copy stuck for nine hours is a problem, not a skip", todo == [] and problem and not skip)

# --- run: check last night's copy, delete down to three, never make one ---
def nights():  # fresh copies each time: a delete marks the copy object itself
    return [copy(10), copy(11), copy(12), copy(13)]  # Oct 13's copy was made half an hour before NOW


night = nights()
fake = FakeOracle(night + [copy(9, vol=OTHER)])
code, marker = run(fake)
check("four held: the oldest goes, leaving three for tonight's copy", deleted(fake) == [night[0].id], str(deleted(fake)))
check("the job never makes a copy", creates(fake) == [], str(fake.calls))
check("another disk's copy is never touched", fake.copies[copy(9, vol=OTHER).id].lifecycle_state == "AVAILABLE")
check("a good run exits 0", code == 0, LOG["text"])
check("the marker says when, how many are left and whether last night's copy is free",
      marker.exists() and marker.read_text().split() == ["2026-10-13T06:30:00Z", "3", "yes"],
      marker.read_text() if marker.exists() else "no marker")

fake = FakeOracle(nights()[1:])
code, marker = run(fake)
check("three held: nothing deleted, all fine", code == 0 and deleted(fake) == [] and marker.exists())

fake = FakeOracle([copy(10), copy(11)])
code, marker = run(fake)
check("no copy in 26 hours fails the run and names the schedule",
      code == 1 and "permtracker-daily-keep3" in LOG["text"] and not marker.exists(), LOG["text"])

billed = {"orcl-cloud": {}}
fake = FakeOracle(nights()[:3] + [copy(13, tags=billed)])
code, marker = run(fake)
check("a billed copy from last night fails the run, so the alarm emails", code == 1, LOG["text"])
check("and it's the one deleted, billed copies first", deleted(fake) == [copy(13, tags=billed).id], str(deleted(fake)))
check("and the marker says it wasn't free", marker.exists() and marker.read_text().split()[2] == "no")

fake = FakeOracle(nights())
code, marker = run(fake, dry_run=True)
check("a dry run deletes nothing and writes no marker", deleted(fake) == [] and not marker.exists())

fake = FakeOracle([copy(d) for d in range(5, 14)], page_size=3)
code, _ = run(fake)
check("copies spread over several pages are all counted (nine held, six deleted)",
      len(deleted(fake)) == 6, str(len(deleted(fake))))

fake = FakeOracle(nights()[:3] + [copy(13, "CREATING", hours_ago=1)])
code, marker = run(fake)
check("Oracle still making last night's copy: the run steps aside", code == 0 and deleted(fake) == [])

fake = FakeOracle(nights()[:3] + [copy(12, "CREATING", hours_ago=9)])
code, marker = run(fake)
check("a stuck copy fails the run and changes nothing",
      code == 1 and not marker.exists() and not deleted(fake))

# --- ensure_schedule: the nightly schedule stays attached ---
class Schedules:
    def __init__(self, attached, names):
        self.attached, self.names, self.made = attached, names, []

    def get_volume_backup_policy_asset_assignment(self, asset_id):
        return NS(data=self.attached)

    def list_volume_backup_policies(self, compartment_id):
        return NS(data=[NS(display_name=n, id=f"policy-{n}") for n in self.names])

    def create_volume_backup_policy_assignment(self, details):
        self.made.append(details)


quiet = io.StringIO()
with contextlib.redirect_stdout(quiet):
    s1 = Schedules([NS(policy_id="p")], [dc.SCHEDULE_NAME])
    check("an attached schedule is left alone", dc.ensure_schedule(s1, "c", VOL, make_details=details) is None and s1.made == [])
    s2 = Schedules([], ["Gold", dc.SCHEDULE_NAME])
    check("a missing schedule is attached again, ours and not Oracle's",
          dc.ensure_schedule(s2, "c", VOL, make_details=lambda v, p: (v, p)) is None and s2.made == [(VOL, f"policy-{dc.SCHEDULE_NAME}")],
          str(s2.made))
    s3 = Schedules([], ["Gold"])
    check("a schedule that no longer exists is a problem", dc.ensure_schedule(s3, "c", VOL, make_details=details) and s3.made == [])
    s4 = Schedules([], [dc.SCHEDULE_NAME])
    check("a dry run attaches nothing", dc.ensure_schedule(s4, "c", VOL, dry_run=True, make_details=details) is None and s4.made == [])

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
