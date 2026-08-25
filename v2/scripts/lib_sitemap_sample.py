"""Sample a sitemap by route TEMPLATE rather than by URL.

The sitemap carries 16,254 URLs, of which 16,210 are entity pages rendered by
three React components. An audit that fetches all of them costs 16,254
requests to learn what nine would tell you, and a gate nobody can afford to
run stops being run at all.

Shared by `audit_glued_text.py` and `audit_all_pages.py`. Extracted on the
second caller, not the third.
"""
from __future__ import annotations


def route_shape(path: str) -> str:
    """The template a URL renders: leading segments, final slug replaced."""
    parts = [seg for seg in path.strip("/").split("/") if seg]
    if not parts:
        return "/"
    if len(parts) == 1:
        return "/" + parts[0]
    return "/" + "/".join(parts[:-1]) + "/:slug"


def sample_by_shape(
    paths: list[str], per_shape: int
) -> tuple[list[str], dict[str, int]]:
    """
    Take up to `per_shape` URLs per template, in sitemap order.

    Returns the picks AND the true size of every template, because a sampled
    run that reports only its own count reads as full coverage. Callers must
    print what was skipped.
    """
    picked: list[str] = []
    taken: dict[str, int] = {}
    sizes: dict[str, int] = {}
    for path in paths:
        shape = route_shape(path)
        sizes[shape] = sizes.get(shape, 0) + 1
        if taken.get(shape, 0) < per_shape:
            taken[shape] = taken.get(shape, 0) + 1
            picked.append(path)
    return picked, sizes


def describe_sampling(sizes: dict[str, int], per_shape: int) -> list[str]:
    """Lines naming every template that was truncated, and by how much."""
    big = {k: v for k, v in sizes.items() if v > per_shape}
    lines = [f"templates   : {len(sizes)}"]
    if big:
        skipped = sum(v - per_shape for v in big.values())
        detail = ", ".join(
            f"{k} ({v:,})" for k, v in sorted(big.items(), key=lambda kv: -kv[1])
        )
        lines.append(
            f"sampled     : {per_shape}/template; "
            f"{skipped:,} URLs not fetched -> {detail}"
        )
    return lines
