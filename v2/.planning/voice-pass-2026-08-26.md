
## Tools pages (/tools, /calculators)

### `src/app/(site)/(public)/tools/page.tsx`

- OLD: Live figures from the Department of Labor, and free calculators built on them. Each one says where its numbers come from, and says so when it can’t answer.
  NEW: Live figures from the Department of Labor, and free calculators built on them.
- OLD: <h2 className="font-heading text-2xl font-black">One line, cleared oldest first</h2>
  NEW: <h2 className="font-heading text-2xl font-black">The queue, oldest first</h2>
- OLD: Every PERM waits in filing-month order. The tape shows the months DOL has cleared and the months still waiting.{" "}
  NEW: Every PERM waits in filing-month order.{" "}
- OLD: <h2 className="font-heading text-2xl font-black">Six calculators, one per question</h2>
  NEW: <h2 className="font-heading text-2xl font-black">Six calculators</h2>
- OLD: Decision times, the wage queue, the I-140 backlog, priority dates, the whole green card to scale, and every statutory deadline.
  NEW: Decision times, the wage queue, the I-140 backlog, priority dates, the whole green card drawn to scale, and every statutory deadline.
- OLD: blurb: "Median offered wages by occupation - committed figures, not survey estimates.",
  NEW: blurb: "Median offered wages by occupation, from the wage each employer committed to pay.",
- OLD: blurb: "What actually gets denied, by wage, by year, and by what the form declares.",
  NEW: blurb: "What gets denied, by wage, by year, and by what the form declares.",
- OLD: No newsletter, no account. Set it on the{" "}
  NEW: Set it on the{" "}
- OLD: The same date math as the deadline calculator, applied to your cases, with alerts and calendar sync. Free.
  NEW: The same date math as the deadline calculator, applied to your cases, with alerts and calendar sync. The account is free.

### `src/app/(site)/(public)/tools/pwd-calculator/page.tsx`

- OLD: Once the determination lands, the clock is arithmetic
  NEW: The determination sets every date that follows
- OLD: The wait is out of your hands. What happens after isn’t: the recruitment window, the quiet period and the filing window all run from the determination date, and missing one restarts the case.
  NEW: The recruitment window, the quiet period and the filing window all run from the determination date, and missing one restarts the case.
- OLD: Turning that into a date needs a clearance rate, and rather than assume one we measure it from DOL's own figures as they change over time.
  NEW: Turning that into a date needs a clearance rate, which we measure from DOL's own figures as they change over time.

### `src/app/(site)/(public)/tools/perm-timeline-calculator/page.tsx`

- OLD: DOL&apos;s date is a forecast. Yours are arithmetic.
  NEW: The deadlines on your side of the process are fixed
- OLD: Nobody can tell you exactly when DOL will decide. The dates that are genuinely fixed are the ones on your side of the process: the recruitment window, the quiet period, the filing window and the I-140 deadline. Every one of them is arithmetic on your prevailing wage determination, and getting one wrong restarts the case.
  NEW: Nobody can tell you exactly when DOL will decide. The recruitment window, the quiet period, the filing window and the I-140 deadline are arithmetic on your prevailing wage determination, and getting one wrong restarts the case.
- OLD: The honest way to read it’s as a range that narrows as DOL gets closer to your filing month.
  NEW: It’s best read as a range that narrows as DOL gets closer to your filing month.
- OLD: A queue-advance figure looks forwards from how fast the queue is actually moving. Showing one and hiding the other would make the estimate look more certain than it is.
  NEW: A queue-advance figure looks forwards from how fast the queue is moving now.

### `src/app/(site)/(public)/tools/i140-calculator/page.tsx`

- OLD: No, and nobody honestly can. USCIS publishes pending petitions by category
  NEW: No. USCIS publishes pending petitions by category

### `src/app/(site)/(public)/tools/green-card-timeline/page.tsx`

- OLD: Any single total that covers all of it’s hiding that variation.
  NEW: Any single total that covers all of it hides that variation.
- OLD: and we don’t have an automated way to read it. Putting an estimate there without a source we can stand behind would be inventing a legally consequential date.
  NEW: and we don’t have an automated way to read it.
- OLD: name: "Your deadlines", blurb: "The dates the regulations fix." }
  NEW: name: "Your deadlines", blurb: "Every deadline in your case." }
- OLD: note: "The stages in detail, and the rules that fix the ones you control." }
  NEW: note: "The stages in detail, and the rules behind the ones you control." }

### `src/app/(site)/(public)/calculators/page.tsx`

- OLD: How many wage requests sit ahead of yours. DOL publishes this one as an actual pending count, so it’s a fact rather than a model.
  NEW: How many wage requests sit ahead of yours, from the pending count DOL publishes.
- OLD: next to the processing time USCIS publishes. The two disagree, and the gap is the useful part.
  NEW: next to the processing time USCIS publishes.
- OLD: Where a priority date sits against the visa bulletin, and which way the cutoff has moved. It goes backwards more often than people expect.
  NEW: Where a priority date sits against the visa bulletin, and which way the cutoff has moved, including the months it moved backwards.
- OLD: Every stage drawn to scale, from the wage queue to the wait for a visa number. Shows which parts are fixed by regulation, which are queues, and which nobody can put a number on.
  NEW: Every stage drawn to scale, from the wage queue to the wait for a visa number, marked by which are fixed by regulation, which are queues, and which have no published figure.

## Tools components (src/components/tools)

### `src/components/tools/PermDeadlineCalculator.tsx`

- OLD: These aren’t estimates. Every date below is fixed arithmetic on the prevailing wage determination under 20 CFR 656.
  NEW: Every date here is fixed arithmetic on the prevailing wage determination under 20 CFR 656.

### `src/components/tools/PwdQueueEstimator.tsx`

- OLD: Pick the month DOL received your ETA-9141. The number of requests ahead of yours is DOL&apos;s own published count, not an estimate.
  NEW: Pick the month DOL received your ETA-9141. The number of requests ahead of yours is DOL&apos;s own published count.

### `src/components/tools/PermTimelineEstimator.tsx`

- OLD: Pick the month DOL received your ETA-9089. Every figure below comes from DOL&apos;s own published data, and each one says where it came from.
  NEW: Pick the month DOL received your ETA-9089. Every figure comes from DOL&apos;s own published data.

### `src/components/tools/GreenCardTimelineView.tsx`

- OLD: The rest is queue time at DOL and USCIS, plus a wait for a visa number that no published figure covers. The recruitment window is the part you set the pace on, and it’s the part that restarts the case if a date is missed.
  NEW: The rest is queue time at DOL and USCIS, plus a wait for a visa number that no published figure covers. The recruitment window is the one you set the pace on, and missing a date there restarts the case.

### `src/components/tools/PriorityDateEstimator.tsx`

- OLD: For the current cutoff, read it at the source. What everything below has that the current bulletin doesn’t is the movement: {bulletins.length} bulletins of it, including the months the cutoff went backwards.
  NEW: For the current cutoff, read it at the source. What the archive holds and a single bulletin doesn’t is the movement:{" "} {bulletins.length} bulletins of it, including the months the cutoff went backwards.
- OLD: Everything below comes from that bulletin and the ones before it. Cutoffs change every month, in both directions.
  NEW: These figures come from that bulletin and the ones before it. Cutoffs change every month, in both directions.
- OLD: You have the <strong>{selectedChartName}</strong> chart selected above, which is the other one.
  NEW: You have the <strong>{selectedChartName}</strong> chart selected, which is the other one.
- OLD: That’s the gap to watch when the category reopens. October starts a new fiscal year with a fresh allocation of visa numbers, and the cutoff the category reopens at is set then. It isn’t obliged to return to where it stood.
  NEW: October starts a new fiscal year with a fresh allocation of visa numbers, and the cutoff the category reopens at is set then. It can reopen anywhere, earlier or later than where it stood.
- OLD: with the new year&apos;s numbers. It’s a normal annual event, not a change in the rules, and it’s most common in the last months of the fiscal year.
  NEW: with the new year&apos;s numbers. It happens every year, most often in the last months of the fiscal year.
- OLD: The chart below still shows where the cutoff stood before it closed, which is the part worth watching.
  NEW: The chart still shows where the cutoff stood before it closed.

### `src/components/tools/CaseBrowser.tsx`

- OLD: That isn’t the same as no such case. DOL&apos;s disclosure files carry decided cases only, so a case still waiting on a determination appears in none of them. If yours is pending, the{" "}
  NEW: DOL&apos;s disclosure files carry decided cases only, so a case still waiting on a determination appears in none of them. If yours is pending, the{" "}

### `src/components/tools/EntityContext.tsx`

- OLD: the {baselineDenialPct.toFixed(2)}% the field as a whole records, so this record can&apos;t be told apart from the field in either direction. Reading it as better or worse than average is reading the sample size.
  NEW: the {baselineDenialPct.toFixed(2)}% the field as a whole records, so this record can&apos;t be told apart from the field in either direction.

## Tools components (continued)

### `src/components/tools/PwdBacklogChart.tsx`

- OLD: Every month DOL still has undecided prevailing wage requests in, oldest first. The bars are counts, not a rate of clearance.
  NEW: Every month DOL still has undecided prevailing wage requests in, oldest first. Each bar is a count of requests still pending.

### `src/components/tools/DeadlineWindowDiagram.tsx`

- OLD: Every span from the dates entered, drawn to one scale. The filing window is the target; everything else explains its edges.
  NEW: Every span from the dates entered, drawn to one scale.

### `src/components/tools/PriorityDateEstimator.tsx`

- OLD: And, more usefully, which way the line has been moving. Cutoffs go backwards as well as forwards.
  NEW: And which way the cutoff has been moving. Cutoffs go backwards as well as forwards.

### `src/components/tools/CaseBrowser.tsx`

- OLD: The case table couldn’t be reached just now. That’s a fault at our end, not an answer about your case. Try again in a minute.
  NEW: The case table couldn’t be reached just now. That’s a fault at our end. Try again in a minute.
- OLD: finds nothing. The filters above don’t apply to it.{" "}
  NEW: finds nothing. The filters don’t apply to it.{" "}

## Tools pages (continued)

### `src/app/(site)/(public)/calculators/page.tsx`

- OLD: Six calculators, one per question </h1>{" "} <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70"> Each one answers a question a PERM case raises, says where its numbers come from, and says so when it can’t answer. </p>
  NEW: PERM calculators </h1>{" "} <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70"> Six calculators, each answering one question a PERM case raises. </p>
