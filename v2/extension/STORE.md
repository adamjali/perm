# Chrome Web Store listing: PERM Tracker: Visa Sponsor Check

Everything the Chrome Web Store's developer console asks for, in the order its
forms ask. The upload is `extension/permtracker-extension-<version>.zip`, made by
`pnpm build:extension` from `v2/`.

## Store listing

**Name** (from the manifest): PERM Tracker: Visa Sponsor Check

**Short description** (from the manifest, 126 of 132 characters):

> See an employer's green card (PERM) and H-1B sponsorship record from U.S. Department of Labor files, right on the job posting.

**Detailed description:**

> Thinking about a job and need a sponsor? Open the posting and PERM Tracker shows that employer's record from the U.S. Department of Labor's own files, without leaving the page.
>
> What you'll see, for the company on the posting:
> - PERM green card cases in DOL's published files, and the share certified (shown once a company has 30 or more decided cases)
> - Cases waiting at DOL right now, from its live case status
> - The newest PERM filing on record
> - H-1B labor condition applications (LCAs) in DOL's published files
> - A link to the company's full record on permtracker.app
>
> It works on LinkedIn, Indeed, Glassdoor, Handshake and Wellfound. On any other job page (Greenhouse, Lever, Ashby, Workday and most company career sites), click the PERM Tracker button in your toolbar and it reads the posting there.
>
> When a posting's name doesn't match a company exactly, the panel says "possible match" and shows the name it matched, so you can tell. When there's no record, it says so plainly. A company can file under a different legal name, so no record doesn't always mean no sponsorship.
>
> Private by design: the only thing sent is the employer's name, to permtracker.app. No cookies, no account, no tracking and no analytics. Nothing about the pages you visit is sent. The details are at permtracker.app/extension#privacy.
>
> PERM Tracker is a free site that publishes DOL's PERM, prevailing wage and H-1B records. It's not affiliated with the U.S. government, and nothing here is legal advice.

**Category:** Productivity

**Language:** English

**Homepage URL:** https://permtracker.app/extension

**Support URL:** https://permtracker.app/contact

**Screenshots:** at least one 1280x800 (or 640x400) PNG of the panel on a job posting. Not made yet; the coordinator takes them from the unpacked build.

## Privacy practices

**Single purpose:**

> Show the U.S. Department of Labor's visa sponsorship record (PERM green card and H-1B filings) for the employer on the job posting the user is viewing.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Keeps each answer in session storage for six hours, so going back to a posting doesn't ask again. Cleared when the browser closes. |
| `activeTab` | When the user clicks the toolbar button on a job page outside the listed sites, lets the extension read that one page's posting, once. |
| `scripting` | Injects the panel's script into that page after the click. Nothing runs on other sites without a click. |
| Host permission `https://permtracker.app/*` | The one server the extension asks, for the employer's record. |
| Content script matches (LinkedIn, Indeed, Glassdoor, Handshake, Wellfound) | Reads the employer's name on job postings on these five job sites. LinkedIn is matched whole because it opens a posting from the feed without loading a new page; on any LinkedIn page that isn't a posting the script reads nothing. |

**Remote code:** No. Every script the extension runs is in the package.

**Data usage** (the form's checkboxes):

- Personally identifiable information: No
- Health information: No
- Financial and payment information: No
- Authentication information: No
- Personal communications: No
- Location: No
- Web history: No
- User activity: No
- **Website content: Yes.** The employer's name printed on the job posting, sent to permtracker.app to look up its record. Nothing else from the page.

Certifications (all true):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://permtracker.app/extension#privacy

## Notes for the reviewer

> To test: install, then open any LinkedIn job posting (for example https://www.linkedin.com/jobs/view/ followed by any job id) or an Indeed posting. A panel appears at the bottom right with the employer's record. On a Greenhouse or Lever posting, click the toolbar button. The lookup is GET https://permtracker.app/v1/lookup/employer?name=<employer>, documented at https://permtracker.app/developers; it needs no account.

## Before the first upload (the owner)

1. A Chrome Web Store developer account: https://chrome.google.com/webstore/devconsole, a one-time US$5 registration fee, signed in with the Google account that should own the listing.
2. Publisher name: **PERM Tracker**, never a person's name.
3. The trader question (EU Digital Services Act): PERM Tracker LLC offers this free, but the form asks whether you act as a trader; that answer, and the contact details a trader must show, are yours to give.
4. Upload the zip, paste the fields above, add the screenshots, submit for review.
5. Once it's published, put the listing's URL in `CHROME_STORE_URL` in `src/app/(site)/(public)/extension/page.tsx`.
