---
description: Look up a DOL case by number (PERM, prevailing wage, H-1B LCA, H-2A, H-2B, CW-1) and say what its status means
argument-hint: <case number, like G-100-26045-123456>
---

Look up DOL case $ARGUMENTS with the permtracker `lookup_case` tool.

Then answer in a few plain sentences: the program, the status DOL shows today and what that status means, the employer and job, when it was filed, and, once decided, DOL's decision and its date. Say the day our record last checked DOL. If it's a pending PERM case, also call `estimate_decision` and give the estimated date with its range, said as an estimate, never a promise. If no record exists, say so and point to https://permtracker.app/perm-case-status, which asks DOL live.
