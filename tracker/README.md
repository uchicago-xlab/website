# AI Safety @ UChicago team tracker

A task tracker for the group's teams (Exec, Marketing, Events, Fellowships, Research). It works like a lighter Asana: every task has an owner, a timeline, steps, docs, notes and a running log of updates. It is built so that people actually keep it up to date and can hold each other accountable.

It has no build step and no server to pay for. The browser app is plain HTML/CSS/JS. The "real" deployment runs on **Google Apps Script**: data goes into a Google Sheet, everyone signs in with their UChicago Google account, Drive files are created for you, and Slack gets the notifications.

- **Try it now:** open `tracker/index.html` in a browser. Once this branch is merged, it is also at `/tracker/` on the Pages site. This is **demo mode**: sample people and tasks, saved only in your browser. Click your name (bottom left) to see the tracker as an exec member, a team lead or a member.
- **Deploy it for the group:** see [Deploying](#deploying-15-minutes) below.

## What's in it

| Area | What it does |
| --- | --- |
| **My work** | Your tasks grouped by Overdue / Today / Next 7 days / Later. **Needs your attention** lists people waiting on your help, steps assigned to you on other people's tasks, and your tasks that need a check-in. |
| **Inbox** | Assignments, @mentions, help requests, nudges and check-ins that involve you. With Slack on, these also arrive as DMs. |
| **Dashboard** | Accountability view for exec and leads. Each team gets a health card (on track / at risk / off track), plus a table of everything overdue, blocked, unowned, off track or stale. It also shows open help requests (oldest first) and each person's workload. Has one-click **Nudge** and **Take it** buttons. |
| **Team pages** | Overview (about, projects with progress, people and their load, team docs, checklists), plus **List**, **Board** (drag between statuses) and **Timeline** (drag bars to reschedule; drag the right edge to change the due date). |
| **Task panel** | Owner, collaborators, status, dates, team, project, priority and health. Also: notes (markdown), **steps** (each with an assignee and due date; drag to reorder), **docs & links** (one-click new Google Doc/Sheet/Slides/Form/folder), **help requests**, **check-ins**, and comments with @mentions. |
| **Docs & checklists** | Shared docs pinned per team ("where's the budget sheet?"), every file attached to any task, and reusable **checklists** (speaker event, marketing campaign, fellowship cohort launch, research kickoff, onboarding, quarter retro). Step due dates are counted back from the task's due date. |
| **People** | Roster by team, with each person's open and overdue tasks. Exec and leads can add people or paste in a whole roster. |

### The accountability loop

The design is built around four habits. They're shown to everyone on first visit:

1. **One owner and a due date per task.** Unowned tasks are flagged on the dashboard and team pages.
2. **Weekly check-ins.** A one-line *on track / at risk / off track* update. After 7 days without one, the task is flagged as stale: it shows on the owner's *My work*, the team's daily Slack digest, and the dashboard.
3. **Ask for help in the task.** The person gets a Slack DM, and the request sits at the top of their *My work* until they mark it resolved. Blocked tasks ping the team lead and post to the team channel.
4. **Docs and notes live in the task**, so next year's board inherits them.

Anyone can **nudge** an owner (once every 12 hours per task) to ask for an update, and every change is logged with who made it.

### Shortcuts

- **Quick add** (in any list) understands `Book Ida Noyes @hannah #events !high due fri`. That means owner `@name`, team `#team`, priority `!low|!med|!high|!urgent`, and a due date (`due today`, `due tomorrow`, `due fri`, `due next mon`, `due 12/5`, `due dec 5`, `due in 3 days`). The same syntax works when you add a step.
- Keys: `N` new task · `/` or `⌘K` search everything · `G` then `H`/`I`/`D`/`A`/`P`/`C` to jump between pages · `Esc` closes things · `⌘/Ctrl+Enter` sends a comment · `?` shows the full list.

### Roles and permissions

Everyone can **see** everything (transparency is the point), comment, ask for help and nudge.

| | Exec | Team lead | Member |
| --- | --- | --- | --- |
| Edit tasks | all teams | own team(s) | own team(s), plus tasks they own, created or collaborate on |
| Delete tasks | any | own team | ones they created |
| Projects | any | own team | create in own team |
| People | add or edit anyone, set roles | add or edit members of their team | edit own profile |
| Teams (names, Slack channels, Drive folders) | ✓ | | |

Anyone can tick off a step assigned to them, on any task. The rules live in `core.js`, which runs both in the browser and on the server, so the server enforces exactly what the UI shows.

## Deploying (≈15 minutes)

You need a UChicago Google account. Ideally use a **shared group account** (for example an exec@ account), not a personal one, so the tracker doesn't break when someone graduates. Everything runs as that account.

1. **Create the Apps Script project.** Go to <https://script.google.com> → *New project*, and name it "AI Safety Tracker".
2. **Add the files** from `tracker/apps-script/`:
   - Replace the default `Code.gs` contents with `Code.gs`.
   - *Files → + → Script*, named `Core`, with the contents of `Core.gs`. Do the same for `Seed` with `Seed.gs`.
   - *Files → + → HTML*, named `Index`, with the contents of `Index.html`.
   - *Project Settings → "Show appsscript.json manifest file in editor"*, then replace `appsscript.json` with ours.

   Or, with [clasp](https://github.com/google/clasp):

   ```bash
   npm install -g @google/clasp
   ```

   ```bash
   clasp login
   ```

   ```bash
   clasp create --type webapp --title "AI Safety Tracker" --rootDir tracker/apps-script
   ```

   `clasp create` replaces our manifest with a default one, so restore it before pushing:

   ```bash
   git checkout tracker/apps-script/appsscript.json
   ```

   ```bash
   clasp push
   ```

3. **Run setup.** In the editor, pick `setup` in the function menu and click **Run**, then approve the permissions. (Use `setupWithSampleData` instead if you want the demo tasks for a trial run.) Setup:
   - creates the **"AI Safety Tracker data"** spreadsheet
   - creates an **"AI Safety Tracker files"** Drive folder and shares it with uchicago.edu
   - seeds the teams, checklists and shared docs
   - adds *you* as exec
   - installs the daily and weekly Slack triggers

   The links appear in the execution log.
4. **Deploy.** *Deploy → New deployment → Web app*: **Execute as: Me**, **Who has access: Anyone within University of Chicago**. Copy the web app URL. That is the tracker.
5. **Load the roster.** Open the URL, go to *Settings → People → Import roster*, and paste one line per person: `Name, email, role, teams, title` (role is `exec`, `lead` or `member`; separate several teams with `;`). Tick "remove the sample people".
   > I couldn't reach uchicagoaisafety.com/leadership from the build environment, so the roster ships with **placeholder names**. Copy the real leadership list into the import box. Emails are what connect people to their Google sign-in and their Slack account.
6. **Share the link.** Pin it in Slack and in each team channel's bookmarks. Anyone else at UChicago who opens it can add themselves as a member (set `JOIN_MODE` to `closed` to allow only people you've imported).

### Connect Slack

1. Go to <https://api.slack.com/apps> → *Create New App → From scratch* and pick your workspace. (Your workspace admin may need to approve it.)
2. Under *OAuth & Permissions → Bot Token Scopes*, add `chat:write`, `chat:write.public`, `users:read`, `users:read.email` and `im:write`. Then *Install to Workspace* and copy the **Bot User OAuth Token** (`xoxb-…`).
3. In Apps Script, go to *Project Settings → Script properties → Add*: `SLACK_BOT_TOKEN` = the token.
4. In the tracker, open *Settings → Teams → Edit* and paste each team's **Slack channel ID**. (In Slack: open the channel → click its name → the ID is at the bottom of *About*.) Private channels need `/invite @your-app`.
5. Click *Settings → Integrations → Send a test message*.

What gets sent:

- **DMs** when you're assigned a task or step, @mentioned, nudged, or asked for help, and when someone resolves your help request or comments on your task.
- **Team channel posts** when a task is blocked, completed, or checked in as at risk or off track.
- **8am daily DM** with your overdue, due-today and due-soon tasks, help requests waiting on you, and tasks that need a check-in. Plus a daily team digest of overdue, blocked, unowned and stale tasks (quiet days are skipped).
- **Monday 9am summary** for exec, posted to the Exec team's channel.

People are matched to Slack by email. If someone's Slack email differs, they can add their Slack member ID in their profile. Prefer something simpler? Set `SLACK_WEBHOOK_URL` (an [incoming webhook](https://api.slack.com/messaging/webhooks)) instead of the bot token, and everything goes to one channel with names in the text.

### Google Drive

- **New Google file** in any task creates a Doc, Sheet, Slides or Form inside that task's own folder, creates the folder if needed, and attaches both. Folders are organized as `AI Safety Tracker files / <Team> / <Task>`.
- To use existing team folders, paste each team's Drive folder link in *Settings → Teams*. New task folders then go inside it.
- Better still, put the root folder in a **Shared Drive** (so files belong to the group, not a person) and set the `DRIVE_FOLDER_ID` script property to it.
- Paste any Drive link into a task and the tracker fills in the file's real name, if the deploying account can see it.

### Script properties

| Property | Default | Meaning |
| --- | --- | --- |
| `SPREADSHEET_ID` | set by `setup` | where data lives |
| `DRIVE_FOLDER_ID` | set by `setup` | root folder for task files |
| `ALLOWED_DOMAIN` | `uchicago.edu` | only these accounts get in |
| `JOIN_MODE` | `open` | `open`: anyone in the domain can add themselves as a member. `closed`: only people on the roster. |
| `SLACK_BOT_TOKEN` | – | turns on Slack DMs and channel posts |
| `SLACK_WEBHOOK_URL` | – | alternative single-channel Slack |
| `DIGEST_HOUR` | `8` | daily digest hour (Chicago time). Re-run `installTriggers` after changing it. |

## Changing the code

Source files are in `tracker/`:

- `core.js`: data model, permissions and every change (shared by browser and server)
- `seed.js`: teams, sample roster, checklists, demo tasks
- `app-util.js`: helpers, icons, markdown, popovers, modals
- `app-views.js`: pages
- `app-panel.js`: task panel and dialogs
- `app-main.js`: state, sync, routing, events
- `tracker.css`

`tracker/apps-script/Code.gs` is the server.

After editing, rebuild the Apps Script bundle and push:

```bash
python3 scripts/build-tracker.py
```

```bash
clasp push
```

Then go to *Deploy → Manage deployments → Edit → Version: New version*. The URL stays the same. `Index.html`, `Core.gs` and `Seed.gs` in `apps-script/` are generated: edit the sources, not them.

## How it works, and its limits

- The browser applies each change instantly, then sends it to the server. The server re-runs the same `applyOp` under a lock, saves the row, and sends Slack messages. If the server rejects a change, the browser rolls it back. Other people's changes arrive every 20 seconds, and when the tab regains focus.
- Each task is one row in the sheet: readable columns plus a JSON column. Exec can open the spreadsheet from *Settings*. *Settings → Export* downloads everything as JSON. Deleted items are only flagged, so they can be recovered from the sheet.
- Google limits a cell to 50,000 characters, so a task's activity log keeps its most recent ~300 entries. Long documents belong in a linked Google Doc anyway.
- Apps Script quotas (about 20,000 Slack calls a day, and around 30 people saving at the same moment) are far above what a student org needs. Hundreds of tasks per quarter are fine. If you ever outgrow it, `core.js` and the UI can sit on a real database unchanged.
- Board drag-and-drop uses the browser's native drag, which phones don't support. On a phone, change status from the task panel.
