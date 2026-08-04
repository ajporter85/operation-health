# docs/ideas — the brainstorm inbox

This folder is where **pre-engineering thinking** lands: half-formed ideas about
training, routines, habits, nutrition approach — things that start as a
conversation and *might* eventually become a slice of the app.

It is the handoff point between brainstorming in the **Claude app** and building
in **Claude Code**.

## It is private

**Everything in this folder is gitignored except this README.** Notes here are
expected to carry real personal detail — macros, weights, injuries, medical
context — and the repo is public. So the notes live on this machine only, exactly
like `live-data/` (see that folder's README for the same reasoning).

Two consequences worth knowing:

1. **The Claude app can't fetch these from GitHub.** Moving a note between the app
   and this repo is a manual copy/paste in both directions. That's the price of
   keeping them private, and it's a small one at this volume.
2. **Git is not backing these up.** If the machine dies, the notes go with it.
   Same mitigation as `live-data/`: keep the repo folder on a synced private
   drive, or copy these off-machine now and then.

## The safety net

Because git can't undo anything here, `snapshot-ideas.ps1` (in the repo root)
makes timestamped copies of this folder to `%USERPROFILE%\OperationHealth-Backups\`
— deliberately outside the repo, so they can never be committed, and outside the
reach of anything with write access to this folder.

```
powershell -ExecutionPolicy Bypass -File .\snapshot-ideas.ps1
```

It skips when nothing has changed and keeps the newest 30. Run it before letting
any tool write in here; see the bottom of the script to schedule it daily.

If the manual round-trip ever gets annoying, the upgrade path is a **separate
private repo** for ideas — the Claude app can be connected to a private repo,
which restores the automatic sync without putting anything in public.

## The round-trip

1. **Brainstorm in the Claude app.** No code, no constraints — just think.
2. **Close the session with:** *"Summarize this into a markdown doc for the
   `docs/ideas/` folder of my Operation Health repo — what we decided, what's
   still open, and what it would mean for the app."*
3. **Save the result here** as `<topic>.md`.
4. **Later, in Claude Code:** point at the file when the matching module comes up.
   It becomes input to the build plan, not the build plan itself.

Going the other direction — giving the Claude app the app's actual constraints —
paste in the public docs, which *are* on GitHub:

- `docs/Operation_Health_Vision_and_Requirements.md`
- `docs/Operation_Health_Technical_Design.md`

## The shared profile

`profile.md` (local-only, like everything else here) holds the baseline metrics
macro/TDEE calculators ask for — age, sex, height, weight, activity, goal. Notes
in this folder should **read from it rather than restating the numbers**, so they
get corrected in one place.

The rule that keeps this safe: **schema is public, values are private.** Saying
"the profile has age/sex/height/weight/activity/goal" is a feature description and
belongs in the public docs. The actual numbers never leave this folder.

## Note format

No rigid template, but a note is most useful later if it ends with:

- **Decided** — what you actually settled on
- **Open questions** — what you punted
- **App implications** — what this would mean to build, if anything

Not every note has to become a feature. Some are just thinking, and that's fine.
