# XLab website: notes for Claude

Handover from the session that built this site (Oct–Nov 2026). Read this before
touching anything.

## What this is

Static HTML site for the University of Chicago Existential Risk Laboratory
(XLab). No build step. GitHub Pages serves `main` at **https://xrisk.uchicago.edu**
(custom domain set by the `CNAME` file; never delete it). The old
`uchicago-xlab.github.io/website/` address redirects there.

Pages: `index.html`, `about.html`, `fellowship.html`, `fellows-outputs.html`,
`risk-areas.html`, `risk-ai.html`, `risk-nuclear.html`, `nuclear-top-ten.html`.
Shared: `css/site.css` (responsive layer, brand fonts, nuclear-page components,
reveal animation, fellows grid), `js/site.js` (mobile nav, News carousel,
pop-up modals, scroll reveal), `js/image-slot.js` (the `<image-slot>` web
component, still used on about/risk pages; the fellows page uses plain `<img>`).

## People (get these right)

- **Madeleine Hoffman** (user, GitHub `mnhoffman`, Chief of Staff, undergrad). Sign emails "Madeleine".
- **Madeline "Maddie" Berzak**: Director, Nuclear Risk. Different person.
- **Daniel Holz**: Director, owner of record for IT. GitHub `deholz`.
- **Alice Cai**: Operations (added Oct 12).
- Second Look: Zephaniah Roe (`zroe1`), Yixiong Hao, Harshul Basava.
- Repo admins: mnhoffman, zroe1, YixiongHao, harshul-basava. `main` has a
  ruleset: PRs required, no force pushes. GitHub's own settings page cannot
  commit to main, so anything it would commit (e.g. CNAME) goes through a PR.

## Working conventions

- Branch `claude/eager-cray-t6wu8u` (reset it from `origin/main` after each
  merge: `git checkout -B claude/eager-cray-t6wu8u origin/main`). One PR per
  request; Madeleine merges via the GitHub web UI. She does not use git locally.
- **Cache busting is mandatory.** Every page loads
  `css/site.css?v=…`, `js/site.js?v=…`, `js/image-slot.js?v=…` with the same
  value (last: `20261007g`). Bump it in every HTML file whenever CSS/JS change.
  Replaced images get a new filename or `?v=N` on the `src`.
- Safari hard refresh is Option+Cmd+R (Cmd+Shift+R opens Reader). Suggest a
  private window when she "can't see changes".
- Headline convention: XOX Stencil only for the two homepage headlines; all
  other headings UChicago Sans Serif Bold, uppercase, letter-spacing 0.12em.
  Section h2 on the nuclear pages is 26px. Brand colours: Maroon #800000,
  Type Grey #4D4D4D, Light Greystone #D9D9D9, Dark Greystone #737373,
  Footer Grey #404040. No tints. WCAG AA.
- Verify before pushing: Python HTMLParser tag-balance check, local
  `python3 -m http.server` + playwright-core screenshots at 1280 and 390
  (Chromium at `/opt/pw-browsers/chromium`; `npm install playwright-core`
  in the scratchpad if missing). Brand fonts live on an S3 host the headless
  browser cannot reach; abort those requests or route to local woff2 files.
  Background servers die between Bash calls: start the server and the
  Playwright run in the same command, on a fresh port each time.
- Images: Pillow (+ numpy, opencv-python-headless<4.13 for the Haar face
  detector) in a venv. Fellow headshots are 800×800 colour webp q85, faces at
  the same height/scale as Daniel Ben-Levi's and Justin Chen's cards (face
  centre y ≈ 0.455, face height ≈ 0.347 of the frame). Staff headshots on the
  About page are black-and-white, cropped to 190:232. Nuclear-page people are
  black-and-white circles. Originals of the 2026 cohort uploads are in git
  history at commit `d87de0c` (`<Initials>_1.JPG`).
- Google Drive MCP: files over ~7 MB crash the connector (it reconnects).
  Large downloads land in the tool-results dir as JSON `{content: base64}`.
- Network: the environment allowlist decides what's reachable. Madeleine has
  added hosts before (secondlookresearch.com, theintercept.com,
  xrisk.uchicago.edu). DNS lookups and uchicago.edu/github.io hosts are
  blocked unless added. Ask her to add a host rather than working around it.
- Do not put AP/wire photos on the site (the Intercept article image is a
  licensed AP photo; the pop-up keeps Berzak's headshot instead).

## Fellows page specifics

- 2026 card order: Ben-Levi, Min, Parkin / Peters, Fowler, Chen / Wilcox,
  Kasprova, Guo / Park, Rangaraju. Name overlay gradient starts at 66%.
- "Second Look" tab: 8 fellows from secondlookresearch.com; Wei, Qi and
  Thompson show "Replication write-up forthcoming".
- Grid is `minmax(0,1fr)` with padding-based square photo boxes (Safari fix).
- Migrated old-site PDFs live under `files/` at their old paths; links are
  relative.

## Hosting status (as of Nov 5, 2026)

Done: IT approval (Knut Boehmer, Information Assurance), CNAME live, site
serving over HTTPS at xrisk.uchicago.edu, Daniel set as owner of record,
branch ruleset in place. **Open:** GitHub domain verification still fails
("couldn't find the TXT record" at
`_github-pages-challenge-uchicago-xlab.xrisk.uchicago.edu`); IT contact for
DNS is Nick (Web Services). After it verifies: website registry update and a
closing note to Knut. `www.xrisk.uchicago.edu` should CNAME to
`uchicago-xlab.github.io`; confirm it redirects once live.

## Content still pending from Madeleine or others

- p(missy) and Atlas tools section on the nuclear page (needs logos,
  descriptions, links).
- Better gallery photos for CCCR, Patrick Park, Sandia; `Cambridge_Harari.jpg`
  in the Drive is too big for the connector (ask for a resized copy).
- Will Fowler's real paper title; school lines for Kasprova and Fowler.
- Revised papers from the "hold" fellows (Rose, Cullison, Yadav, Min done,
  Rangaraju done); files from Evie Hu, Victoria Kurakata, Julian Huang, Alex
  Do (extensions were granted).
- PDF for "Eliciting Situational Awareness in LLMs Through Fine-Tuning"
  (Nihlani / Rajakumar, 2024): title is plain text until it turns up.
- Titles for the three pending Second Look write-ups.
