# Voice pass, 2026-08-26

Every user-visible string changed in the site-wide voice pass, old -> new,
grouped by the commit that shipped it and then by file.

The trigger was a practicing immigration attorney's read of the live site:
"sounds salesy... desperate... this language is not normal language... don't
try too hard, just simple professional... too much text, let the data speak."
Her own line items were fixed separately in 4332f7b5; this pass is the CLASS
behind them.

Six registers were hunted: salesy/desperate framing, emphatic-minimal tics
("One email." "Free."), captions that editorialize on the figure beside them,
legalese word order, page-talk that points at furniture ("below", "above"),
and the house-banned "not X, it's Y".

JSX scaffolding has been stripped from the entries below so they read as copy.

Commits: d233fbce (tools) - 7d22be58 (data pages) - 2e14f328 (home) -
7e1d4ad8 (auth/FAQ/contact/security) - a8c719a3 (scripted sweep).

## Tools pages (/tools, /calculators)

### `src/app/(site)/(public)/tools/page.tsx`

- OLD: Live figures from the Department of Labor, and free calculators built on them. Each one says where its numbers come from, and says so when it can’t answer.
  NEW: Live figures from the Department of Labor, and free calculators built on them.
- OLD: One line, cleared oldest first
  NEW: The queue, oldest first
- OLD: Every PERM waits in filing-month order. The tape shows the months DOL has cleared and the months still waiting.
  NEW: Every PERM waits in filing-month order.
- OLD: Six calculators, one per question
  NEW: Six calculators
- OLD: Decision times, the wage queue, the I-140 backlog, priority dates, the whole green card to scale, and every statutory deadline.
  NEW: Decision times, the wage queue, the I-140 backlog, priority dates, the whole green card drawn to scale, and every statutory deadline.
- OLD: Median offered wages by occupation - committed figures, not survey estimates.
  NEW: Median offered wages by occupation, from the wage each employer committed to pay.
- OLD: What actually gets denied, by wage, by year, and by what the form declares.
  NEW: What gets denied, by wage, by year, and by what the form declares.
- OLD: No newsletter, no account. Set it on the
  NEW: Set it on the
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

- OLD: DOL’s date is a forecast. Yours are arithmetic.
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
- OLD: "Your deadlines", blurb: "The dates the regulations fix." }
  NEW: "Your deadlines", blurb: "Every deadline in your case." }
- OLD: "The stages in detail, and the rules that fix the ones you control." }
  NEW: "The stages in detail, and the rules behind the ones you control." }

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

- OLD: Pick the month DOL received your ETA-9141. The number of requests ahead of yours is DOL’s own published count, not an estimate.
  NEW: Pick the month DOL received your ETA-9141. The number of requests ahead of yours is DOL’s own published count.

### `src/components/tools/PermTimelineEstimator.tsx`

- OLD: Pick the month DOL received your ETA-9089. Every figure below comes from DOL’s own published data, and each one says where it came from.
  NEW: Pick the month DOL received your ETA-9089. Every figure comes from DOL’s own published data.

### `src/components/tools/GreenCardTimelineView.tsx`

- OLD: The rest is queue time at DOL and USCIS, plus a wait for a visa number that no published figure covers. The recruitment window is the part you set the pace on, and it’s the part that restarts the case if a date is missed.
  NEW: The rest is queue time at DOL and USCIS, plus a wait for a visa number that no published figure covers. The recruitment window is the one you set the pace on, and missing a date there restarts the case.

### `src/components/tools/PriorityDateEstimator.tsx`

- OLD: For the current cutoff, read it at the source. What everything below has that the current bulletin doesn’t is the movement: {bulletins.length} bulletins of it, including the months the cutoff went backwards.
  NEW: For the current cutoff, read it at the source. What the archive holds and a single bulletin doesn’t is the movement: {bulletins.length} bulletins of it, including the months the cutoff went backwards.
- OLD: Everything below comes from that bulletin and the ones before it. Cutoffs change every month, in both directions.
  NEW: These figures come from that bulletin and the ones before it. Cutoffs change every month, in both directions.
- OLD: You have the {selectedChartName} chart selected above, which is the other one.
  NEW: You have the {selectedChartName} chart selected, which is the other one.
- OLD: That’s the gap to watch when the category reopens. October starts a new fiscal year with a fresh allocation of visa numbers, and the cutoff the category reopens at is set then. It isn’t obliged to return to where it stood.
  NEW: October starts a new fiscal year with a fresh allocation of visa numbers, and the cutoff the category reopens at is set then. It can reopen anywhere, earlier or later than where it stood.
- OLD: with the new year’s numbers. It’s a normal annual event, not a change in the rules, and it’s most common in the last months of the fiscal year.
  NEW: with the new year’s numbers. It happens every year, most often in the last months of the fiscal year.
- OLD: The chart below still shows where the cutoff stood before it closed, which is the part worth watching.
  NEW: The chart still shows where the cutoff stood before it closed.

### `src/components/tools/CaseBrowser.tsx`

- OLD: That isn’t the same as no such case. DOL’s disclosure files carry decided cases only, so a case still waiting on a determination appears in none of them. If yours is pending, the
  NEW: DOL’s disclosure files carry decided cases only, so a case still waiting on a determination appears in none of them. If yours is pending, the

### `src/components/tools/EntityContext.tsx`

- OLD: the {baselineDenialPct.toFixed(2)}% the field as a whole records, so this record can’t be told apart from the field in either direction. Reading it as better or worse than average is reading the sample size.
  NEW: the {baselineDenialPct.toFixed(2)}% the field as a whole records, so this record can’t be told apart from the field in either direction.

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
- OLD: finds nothing. The filters above don’t apply to it.
  NEW: finds nothing. The filters don’t apply to it.

## Tools pages (continued)

### `src/app/(site)/(public)/calculators/page.tsx`

- OLD: Six calculators, one per question Each one answers a question a PERM case raises, says where its numbers come from, and says so when it can’t answer.
  NEW: PERM calculators Six calculators, each answering one question a PERM case raises.

## Data pages: /perm-processing-times, /perm-by-state

### `src/app/(site)/(public)/perm-processing-times/page.tsx`

- OLD: PERM Tracker reads that source weekly and stores every publication. Nothing is estimated or modelled.
  NEW: PERM Tracker reads that source weekly and stores every publication.
- OLD: Where the Department of Labor’s queues actually stand, taken from DOL’s own published figures and refreshed every week.
  NEW: Where the Department of Labor’s queues stand, from DOL’s own published figures, refreshed every week.
- OLD: Every PERM waits in filing-month order and DOL clears the line oldest first. Solid months are cleared; the flag is where the queue stands today.
  NEW: Every PERM waits in filing-month order. Solid months are cleared; the flag is where the queue stands today.
- OLD: . That’s the difference between two dates DOL published, not a forecast of the next one.
  NEW: . That’s the difference between two dates DOL published.
- OLD: Every reading DOL has published since we started keeping them. DOL shows only its current position; the record is ours.
  NEW: Every reading DOL has published since we started keeping them.
- OLD: The queue position says where the line is. This says how fast DOL is emptying it: every determination in the quarterly disclosure files, counted by the month it was issued. From the disclosure files rather than the weekly queue page, so it lags by a quarter and gains a year and a half of history in return.
  NEW: Every determination in DOL’s quarterly disclosure files, counted by the month it was issued. Those files lag the weekly queue page by a quarter and carry a year and a half of history.
- OLD: DOL’s figures describe its position across every case. The calculator puts your own filing month against them and shows what each way of measuring implies.
  NEW: The calculator reads your own filing month against these figures.
- OLD: Nothing is modelled or extrapolated. Where a number is missing, DOL didn’t publish one, and we say so rather than filling the gap.
  NEW: Where a number is missing here, DOL didn’t publish one.
- OLD: These are DOL’s deadlines. Yours are the ones you control.
  NEW: The deadlines you control
- OLD: The queue moves when it moves. The dates that are actually in your hands are the recruitment window, the quiet period and the filing window, and every one of them is fixed arithmetic on your prevailing wage determination date. PERM Tracker computes them for every case you run, and warns you before the deadline that matters rather than after it.
  NEW: The recruitment window, the quiet period and the filing window are fixed arithmetic on your prevailing wage determination date. PERM Tracker computes them for every case you run and sends a reminder before each one.
- OLD: Free, and there’s no case limit. See the
  NEW: There’s no case limit. See the

### `src/app/(site)/(public)/perm-by-state/page.tsx`

- OLD: Every certified, denied and withdrawn case in the current disclosure window, placed at its worksite state. The map shades by volume, approval rate, denial rate, median days or median wage. Hovering a state reads it, and tapping pins it.
  NEW: Every certified, denied and withdrawn case in the current disclosure window, placed at its worksite state. Hover a state to read it, tap to pin it.
- OLD: DOL works one national queue, so median days barely move by state. Volume and wages move a lot. That’s industry mix, not a faster line. The
  NEW: DOL works one national queue, so median days barely move by state. Volume and wages move a lot, which is industry mix. The
- OLD: The smallest jurisdictions here decide a couple of dozen cases in a whole window. One denial swings a rate like that by several points, so the map leaves them uncoloured on rates and medians rather than shading them as if the figure meant the same thing it does in California. Drop the floor to nothing and they come back, with the same denominator sitting beside them in the table. Denial rates ranked this way, with a 95% range on each one, are on the
  NEW: The smallest jurisdictions decide a couple of dozen cases in a whole window, where one denial swings a rate by several points. Those stay uncoloured on rates and medians. Drop the floor to nothing and they come back, with the same denominator beside them in the table. Denial rates ranked with a 95% range on each are on the
- OLD: Benchmark a case against the national medians, then let the tracker carry the deadlines.
  NEW: Benchmark a case against the national medians, then track its deadlines.

## Data pages: /perm-denial-risk, /perm-wages

### `src/app/(site)/(public)/perm-denial-risk/page.tsx`

- OLD: Measured, not modeled What actually gets denied PERM denials are rare and concentrated. These are the rates DOL’s files record, cut by the factors the form itself asks about, by the job, and by where the work is.
  NEW: Denial rates What gets denied The denial rates DOL’s files record, by the factors the form asks about, by job, and by worksite.
- OLD: sit on neither side of that ratio, because a withdrawal isn’t an approval and not a denial. It’s the reference every other rate is measured against.
  NEW: sit on neither side of that ratio, because a withdrawal is neither an approval nor a denial. It’s the reference every other rate is measured against.
- OLD: Each bar is the denial rate of a group, measured. It isn’t the probability that a particular case is denied, and the factors are not independent of each other: wage correlates with occupation, which correlates with everything else. A single blended risk score built from these would read as precision we can’t support, so what you get is the measured rates and nothing layered on top.
  NEW: Each bar is the denial rate of a group. It isn’t the probability that a particular case is denied, and the factors are not independent of each other: wage correlates with occupation, which correlates with everything else. A single blended risk score built from these would read as precision the data can’t support, so these are the measured rates, unblended.
- OLD: Denial rate falls as the offered wage rises, and the lowest band isn’t the worst one.
  NEW: Denial rate against the wage the employer offered, in bands.
- OLD: The rate moves year to year, so a figure quoted without its year is a figure without a meaning.
  NEW: The rate moves year to year, so every figure here carries its year.
- OLD: Denials cluster in a handful of job families and are close to absent in others. The floor decides how small a group is allowed to carry a rate at all; the family filter and the search narrow it further.
  NEW: Denials cluster in a handful of job families and are close to absent in others. Occupations below the minimum population carry no rate.
- OLD: DOL works one national queue, so this ranks where denials land, not where cases take longer. Several states decide too few cases to carry a rate at all, which is what the floor is for.
  NEW: DOL works one national queue, so this ranks where denials land. Several states decide too few cases to carry a rate at all, which is what the floor is for.
- OLD: Denials are rare. Most of the wait is queue, not risk. The
  NEW: Denials are rare, and most of the wait is queue time. The

### `src/app/(site)/(public)/perm-wages/page.tsx`

- OLD: Offered wages, not survey estimates
  NEW: From DOL’s own disclosure files
- OLD: The wage on a PERM filing is the wage the employer committed to in a federal filing, which is harder currency than any salary survey. These are the medians by occupation for the current disclosure window.
  NEW: The wage on a PERM filing is the wage the employer committed to in a federal filing. These are the medians by occupation for the current disclosure window.
- OLD: From {ladder.count.toLocaleString("en-US")} certified cases. The gap between the 25th and the median is the two-market split: hourly roles at one end, salaried knowledge work at the other.
  NEW: From {ladder.count.toLocaleString("en-US")} certified cases. The gap between the 25th and the median spans hourly roles at one end and salaried knowledge work at the other.
- OLD: Median of the occupation medians below. The centre of what a sponsored role pays across all {occupationCount.toLocaleString("en-US")} occupations.
  NEW: Median of the occupation medians, across all {occupationCount.toLocaleString("en-US")} occupations.
- OLD: Search by title or SOC code, narrow to a job family, sort any column, take the whole thing as a CSV.
  NEW: Search by title or SOC code, filter by job family, sort any column, or download the CSV.
- OLD: Your own case’s pace depends on its filing month, not its wage. The
  NEW: A case’s pace depends on its filing month rather than its wage. The
- OLD: says exactly how every figure is computed.
  NEW: says how every figure is computed.

## Data pages (continued)

### `src/app/(site)/(public)/perm-wages/page.tsx`

- OLD: Every certified case in the window with a readable wage, sorted and cut at five points. A single median would hide what this distribution actually looks like.
  NEW: Every certified case in the window with a readable wage, sorted and cut at five points.

## Data pages: /perm-employers, /perm-attorneys, /perm-cases, /methodology

### `src/app/(site)/(public)/perm-employers/page.tsx`

- OLD: A big sponsor isn’t a faster one: DOL works one national queue, oldest first, whoever filed the case.
  NEW: DOL works one national queue, oldest first, whoever filed the case.
- OLD: Their volume says how practiced the process is; your date says when you clear it. The
  NEW: Their volume doesn’t change your place in line. The

### `src/app/(site)/(public)/perm-attorneys/page.tsx`

- OLD: Every PERM filing names the firm that made it. All {firmCount.toLocaleString("en-US")} of them are here, with what each one’s cases did.
  NEW: Every PERM filing names the firm that made it. All {firmCount.toLocaleString("en-US")} of them, with volume, approval rate and median days.
- OLD: Volume, not quality. Approval rates cluster above 99% across every firm on this list, so the number that separates them is the work you can’t see in a spreadsheet.
  NEW: Approval rates cluster above 99% across every firm on this list, so the ranking is by volume alone.
- OLD: Benchmark your own volume and median against the field here, then let the tracker carry the deadlines on every case.
  NEW: Benchmark your own volume and median against the field, then track the deadlines on every case.

### `src/app/(site)/(public)/perm-cases/page.tsx`

- OLD: One row per decided case Every case, not just the totals
  NEW: From DOL’s own disclosure files Every decided case
- OLD: determination won’t be here, however recently it was filed. Finding nothing says where your case isn’t, and nothing about how it’s going.
  NEW: determination won’t be here, however recently it was filed.
- OLD: Counts on this page come from that data, not from the rows on screen, so a filtered count is a count of that filter and never of the whole file.
  NEW: Counts come from the full files rather than the rows on screen, so a filtered count covers only that filter.
- OLD: That’s what a pending case looks like. The
  NEW: A pending case is in none of DOL’s files. The
- OLD: takes your filing month and reads it against where DOL is actually working.
  NEW: reads your filing month against where DOL is working now.

### `src/app/(site)/(public)/methodology/page.tsx`

- OLD: published average was 372. This page explains where a spread like that comes from, and how we keep our side of it honest.
  NEW: published average was 372.
- OLD: Readings taken 2026-08-24, all describing average PERM processing time. The spread is real, and most of it has a mechanical cause.
  NEW: Readings taken 2026-08-24, all describing average PERM processing time. Most of the spread has a mechanical cause.
- OLD: rather than the queue. None of these are lies. Publishing the number without saying which choices produced it’s the problem.
  NEW: rather than the queue. None of these choices is wrong on its own. What matters is saying which one produced the number.
- OLD: Medians over immature cohorts. A month whose only decided cases are instant withdrawals has a median of one day, and publishing it would be indefensible.
  NEW: Medians over immature cohorts. A month whose only decided cases are instant withdrawals has a median of one day.
- OLD: Undated numbers. Every figure carries the date of the data behind it, because a number that can’t age is a number you can’t trust.
  NEW: Undated numbers. Every figure carries the date of the data behind it.

## Entity detail pages (/perm-{employers,attorneys,wages}/[slug])

### `src/app/(site)/(public)/perm-employers/[slug]/page.tsx`

- OLD: Volume isn’t quality, and it isn’t speed
  NEW: Volume doesn’t change the wait
- OLD: A big sponsor is a practised one, nothing more. DOL works a single national queue, oldest first, whoever filed the case, so a company with four thousand filings waits exactly as long as one with three.
  NEW: DOL works a single national queue, oldest first, whoever filed the case, so a company with four thousand filings waits exactly as long as one with three.
- OLD: : "It says when this sponsor's cases were filed at least as much as it says anything about the sponsor, because the queue is national and first in, first out."}
  NEW: : "The queue is national and first in, first out, so this figure follows when the cases were filed as much as it follows the sponsor."}
- OLD: Nothing here’s pending
  NEW: Nothing here is pending
- OLD: reads your filing month against where DOL is now, which is the part that actually decides your wait.
  NEW: reads your filing month against where DOL is now.

### `src/app/(site)/(public)/perm-attorneys/[slug]/page.tsx`

- OLD: reads your filing month against where DOL is now, which is the part that actually decides your wait.
  NEW: reads your filing month against where DOL is now.

### `src/app/(site)/(public)/perm-wages/[slug]/page.tsx`

- OLD: Nothing here’s pending
  NEW: Nothing here is pending
- OLD: published as separate rates rather than blended into a score.
  NEW: published as separate rates.

## Entity detail pages (continued)

### `src/app/(site)/(public)/perm-wages/[slug]/page.tsx`

- OLD: This is the median wage employers committed to in federal filings for this occupation, which makes it harder currency than a salary survey. It mixes every experience level and every metro, and it’s a floor rather than a market rate: the employer must offer at least the prevailing wage DOL determines for the occupation, level and county.
  NEW: This is the median wage employers committed to in federal filings for this occupation. It mixes every experience level and every metro, and it’s a floor: the employer must offer at least the prevailing wage DOL determines for the occupation, level and county.

## Home (src/components/home)

### `src/components/home/HeroSection.tsx`

- OLD: A PERM case runs about a year and one missed date can end it. We read DOL’s own published figures and compute every deadline in your case automatically. Free.
  NEW: A PERM case runs about a year, and one missed date can restart it. PERM Tracker reads DOL’s published figures and computes every deadline in your case.

### `src/components/home/StakesSection.tsx`

- OLD: Miss the DOL's 30-day audit window and the case is automatically abandoned. No extensions, no appeals. Start the entire process over.
  NEW: Miss the DOL's 30-day audit window and the case is automatically abandoned. There is no extension and no appeal, and the process starts over.
- OLD: File after expiration and you restart from zero, months of waiting wasted.
  NEW: File after expiration and you restart from zero.
- OLD: What a Missed Deadline Actually Costs
  NEW: What a Missed Deadline Costs
- OLD: Every PERM case has filing windows measured in days, not months. One slip means starting over, or worse.
  NEW: Every PERM case has filing windows measured in days. Missing one means starting the recruitment over.

### `src/components/home/HowItWorks.tsx`

- OLD: Enter your case dates: determination date, recruitment start, filing date. That’s it.
  NEW: Enter your case dates: determination date, recruitment start, filing date.
- OLD: 11 deadline types compute instantly. Filing windows, PWD expirations, audit response dates, all from your dates.
  NEW: 11 deadline types compute from those dates: filing windows, PWD expirations, audit response dates.
- OLD: From case creation to deadline tracking, watch the entire PERM workflow.
  NEW: The whole workflow, from case creation to deadline tracking.

### `src/components/home/FeaturesGrid.tsx`

- OLD: I-140 cutoffs, recruitment method dates. No manual math.
  NEW: I-140 cutoffs, recruitment method dates.
- OLD: Configure reminders at 1, 3, 7, 14, or 30 days. Weekly Monday digest included.
  NEW: Configure reminders at 1, 3, 7, 14, or 30 days, plus a weekly Monday digest.
- OLD: See exactly where each case stands with a color-coded timeline. Instantly spot which cases need attention and which are on track.
  NEW: A color-coded timeline per case, showing which ones need attention and which are on track.
- OLD: expired PWDs, and filing window violations before they become problems.
  NEW: expired PWDs, and filing window violations.
- OLD: Stop juggling spreadsheets and calendar reminders. Every tool you need to manage PERM cases, in one place.
  NEW: Deadline math, alerts, calendar sync and compliance checks, for every case you run.

### `src/components/home/CTASection.tsx`

- OLD: The next filing window is already counting down. Stop Tracking Deadlines Manually No credit card required. Set up in under 5 minutes.
  NEW: Start tracking Every PERM Deadline, Computed Per Case Free, and setup takes a few minutes.

### `src/components/home/SecuritySection.tsx`

- OLD: We don’t sell your data. We don’t train AI on it. Your cases are yours.
  NEW: We don’t sell your data or train AI on it.

### `src/components/home/TestimonialsSection.tsx`

- OLD: Trusted by Practitioners
  NEW: Reviews
- OLD: Applicants and attorneys use PERM Tracker to follow the queue and never miss a deadline.
  NEW: Applicants and attorneys use PERM Tracker to follow the queue and track their deadlines.

### `src/components/home/ToolsSection.tsx`

- OLD: Free calculators on the government’s own numbers. Each one says where its figure came from, and says so when the data can’t answer.
  NEW: Free calculators built on the government’s own numbers.

### `src/components/home/LiveDataBand.tsx`

- OLD: What actually gets denied
  NEW: What gets denied

### `src/components/home/faqData.tsx`

- OLD: deadlines hit, plus Google Calendar sync so your whole team stays aligned."
  NEW: deadlines hit, plus Google Calendar sync."
- OLD: deadlines hit, plus Google Calendar sync so your whole team stays aligned.
  NEW: deadlines hit, plus Google Calendar sync.
- OLD: updates all downstream dates when one date changes. One missed formula in a spreadsheet can cost a client their green card.
  NEW: updates all downstream dates when one date changes.
- OLD: Yes, currently free. No credit card, no trial period, no case limits. We may introduce paid plans in the future, but the core deadline tracking will remain accessible.", rich: "Yes, currently free. No credit card, no trial period, no case limits. We may introduce paid plans in the future, but the core deadline tracking will remain accessible.
  NEW: Yes, currently free, with no credit card and no case limit. We may introduce paid plans in the future, but the core deadline tracking will remain accessible.", rich: "Yes, currently free, with no credit card and no case limit. We may introduce paid plans in the future, but the core deadline tracking will remain accessible.
- OLD: You can also export your data anytime. Your data is always yours."
  NEW: You can also export your data at any time."
- OLD: You can also export your data anytime. Your data is always yours.
  NEW: You can also export your data at any time.
- OLD: "We monitor DOL regulatory changes and update our deadline calculation engine accordingly.
  NEW: "We monitor DOL regulatory changes and update the deadline calculations accordingly.
- OLD: We monitor DOL regulatory changes and update our deadline calculation engine accordingly.
  NEW: We monitor DOL regulatory changes and update the deadline calculations accordingly.

## Home (page metadata)

### `src/app/(site)/(public)/page.tsx`

- OLD: Where DOL's PERM queue stands today, and every case deadline computed automatically. For the person waiting and the person managing. Free.
  NEW: Where DOL's PERM queue stands today, and every case deadline computed automatically. Free, for the person waiting and the person managing.
- OLD: PERM Tracker - Never Lose a Case to a Missed Deadline
  NEW: PERM Tracker - Live PERM Data and Case Deadlines
- OLD: Auto-calculate every PERM filing window, PWD expiration, and audit deadline. Email + push alerts before they hit.
  NEW: Every PERM filing window, PWD expiration and audit deadline, computed from your case dates, with email and push alerts.

## Auth, legal, FAQ, contact, security

### `src/app/(site)/(auth)/signup/SignupPageClient.tsx`

- OLD: toast.success("Welcome to PERM Tracker!");
  NEW: toast.success("Welcome to PERM Tracker.");
- OLD: toast.success("Account verified! Welcome to PERM Tracker.");
  NEW: toast.success("Account verified. Welcome to PERM Tracker.");

### `src/app/(site)/(auth)/reset-password/ResetPasswordPageClient.tsx`

- OLD: toast.success("Password reset successful! Please sign in.");
  NEW: toast.success("Password reset. Please sign in.");

### `src/app/(site)/(auth)/login/LoginPageClient.tsx`

- OLD: toast.success("Email verified! Signing you in.");
  NEW: toast.success("Email verified. Signing you in.");

### `src/app/(site)/(auth)/signup/page.tsx`

- OLD: Create a free PERM Tracker account to start managing your immigration cases. No credit card required.
  NEW: Create a free PERM Tracker account to manage your immigration cases. No account limits and no credit card.

### `src/app/(site)/(public)/faq/page.tsx`

- OLD: plus a calendar view so your whole team stays aligned.
  NEW: plus a calendar view of everything upcoming.
- OLD: updates all downstream dates when one date changes. One missed formula in a spreadsheet can cost a client their green card.
  NEW: updates all downstream dates when one date changes.
- OLD: Yes, completely free. No credit card, no trial period, no case limits. We may introduce optional premium features in the future, but the data, the calculators and the core deadline tracking stay free.
  NEW: Yes, currently free, with no credit card and no case limit. We may introduce optional premium features in the future, but the data, the calculators and the core deadline tracking stay free.
- OLD: You can also export your data anytime. Your data is always yours."
  NEW: You can also export your data at any time."
- OLD: "We monitor DOL regulatory changes and update our deadline calculation engine accordingly.
  NEW: "We monitor DOL regulatory changes and update the deadline calculations accordingly.
- OLD: Clean documentation and well-justified job requirements significantly reduce audit risk.
  NEW: Clean documentation and well-justified job requirements reduce audit risk.
- OLD: The methodology page shows every figure's recipe.
  NEW: The methodology page lists every source and how each figure is built.
- OLD: These are wages employers committed to in federal filings, not survey estimates, which makes them the hardest salary data available for sponsored roles. Hourly and other units are annualized before medians are taken.
  NEW: These are wages employers committed to in federal filings. Hourly and other units are annualized before medians are taken.
- OLD: The rate isn’t evenly spread. Our denial rates page breaks it down by offered wage, by fiscal year, and by the three risk questions the ETA-9089 itself asks, and is explicit that a group rate isn’t a probability for any single case.
  NEW: The rate isn’t evenly spread. The denial rates page breaks it down by offered wage, by fiscal year, and by the three risk questions the ETA-9089 itself asks. A group rate isn’t a probability for any single case.

### `src/app/(site)/(public)/contact/page.tsx`

- OLD: Have questions about PERM Tracker? We’re here to help.
  NEW: Questions, feature requests and bug reports all land in the same inbox.
- OLD: Have an idea to improve PERM Tracker? We’d love to hear it.
  NEW: Ideas for PERM Tracker go on the GitHub issue tracker.

### `src/app/(site)/(public)/security/page.tsx`

- OLD: PERM Tracker takes security seriously. Infrastructure is operated on SOC 2-compliant providers (Convex, Vercel).
  NEW: Infrastructure is operated on SOC 2-compliant providers (Convex, Vercel).
- OLD: Below are public-facing summaries of security-relevant incidents. Entries are factual and preserved for transparency.
  NEW: Public-facing summaries of security-relevant incidents. Entries are kept permanently.

## FAQ (accuracy)

### `src/app/(site)/(public)/faq/page.tsx`

- OLD: PERM Tracker auto-calculates 15+ deadlines per case based on DOL regulations (20 CFR 656)
  NEW: PERM Tracker auto-calculates 11 deadline types per case based on DOL regulations (20 CFR 656)

## Final sweep stragglers

### `src/app/(site)/(auth)/signup/SignupPageClient.tsx`

- OLD: and you get an email before each one. Free.
  NEW: and you get an email before each one.

### `src/app/(site)/(auth)/login/LoginPageClient.tsx`

- OLD: Invalid email or password. If you signed up with Google, use the Google button below.
  NEW: Invalid email or password. If you signed up with Google, use the Google sign-in button.

### `src/components/tools/USStateMap.tsx`

- OLD: The figures above are the counts themselves, which need no floor.
  NEW: Counts carry no floor, so those are shown for every state.

### `src/app/(site)/(public)/faq/page.tsx`

- OLD: What do PERM cases actually pay?
  NEW: What do PERM cases pay?

### `src/app/(site)/(public)/perm-wages/page.tsx`

- OLD: const DESCRIPTION = "What PERM cases actually pay: median offered wages by occupation, with volume and approval rates, from DOL's own disclosure files.";
  NEW: const DESCRIPTION = "What PERM cases pay: median offered wages by occupation, with volume and approval rates, from DOL's own disclosure files.";

### `src/app/(site)/(public)/tools/i140-calculator/page.tsx`

- OLD: "What PERM actually is", note: "The labor certification the petition depends on, in plain terms." }
  NEW: "What PERM is", note: "The labor certification the petition depends on, in plain terms." }

### `src/app/(site)/(public)/tools/green-card-timeline/page.tsx`

- OLD: "What PERM actually is", note: "The labor certification stage, in plain terms." }
  NEW: "What PERM is", note: "The labor certification stage, in plain terms." }


## Home (eyebrow, second pass)

### `src/components/home/CTASection.tsx`

- OLD: <p className="mb-3 font-mono text-sm text-black/60 uppercase tracking-wider"> Start tracking </p>{" "}
  NEW: <p className="mb-3 font-mono text-sm text-black/60 uppercase tracking-wider"> For a caseload </p>{" "}
