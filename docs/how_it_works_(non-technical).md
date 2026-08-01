# How it works (non-technical)

## What is this?

A record-keeping and monitoring tool for a pig farm. It tracks each individual animal — its breed, sex, birth date, ear-tag number, and even its parents — plus the everyday events that happen to it: feeding, weighing, health checks, vaccinations, and breeding. Instead of paper logs or a spreadsheet per farm worker, everything lives in one place a manager can check at a glance. There are two ways in: a phone app for recording what's happening right now, out in the barn, and a computer dashboard for standing back and looking at the whole herd.

## Who would use it

A farm manager who wants to see the whole herd's status without walking every pen, or a field worker recording what happened today — weighing a hog, giving a vaccination, noting something off with an animal. It's also, honestly, a demonstration project — built to produce a real, working system as evidence for an academic report, not (yet) a polished commercial product.

## What problem it solves

Paper records and spreadsheets scatter information across people and pens, and make it hard to see herd-wide trends — is the average weight gain on track? Is one hog falling behind? Nothing flags a problem until someone happens to notice it. Worse, if the only way to record something is to walk back to a laptop, people either delay it or skip it. This system keeps one shared, current picture of the herd, lets a worker capture what just happened on the spot, and raises alerts automatically when something looks off.

## A day in the life

A worker in the barn opens the phone app and lands on a screen with the day's headline numbers and a small grid of buttons: weigh-in, health check, feed, vaccination. Weighing a hog takes picking the animal — recently used ear tags show up first, so a pen that was just weighed yesterday doesn't need searching for — then typing the number and saving. Three taps and a number. Saving shows a quick confirmation with a "Record another" button that drops straight back into the animal picker, so working through a pen of twenty hogs is a short repeated loop rather than twenty trips through a menu.

Later, a manager logs into the dashboard on a computer and sees that same event already reflected: herd size, a growth trend chart, feed efficiency, and any open alerts, all caught up. Clicking into one hog shows its full history — every weigh-in, feed record, health note — plus its vaccination record (how many doses, and whether one is overdue) and, if known, its mother and father. If a hog hasn't been weighed in a while, or its growth looks off, the system raises an alert on its own — nobody has to remember to check.

## Who sees what

Three kinds of accounts on a farm: a **manager**, who can record and edit everything and also manage the farm's settings — adding staff accounts, changing a colleague's role, and renaming the farm; a **worker**, who can record and edit day-to-day events (feeding, weighing, health, vaccinations, breeding) but can't touch settings; and a **viewer**, who can look but not touch anything — useful for showing a supervisor the numbers without letting them change anything. A manager can hand out worker or viewer accounts, but deliberately cannot create — or demote anyone down to — another manager account; that's a one-way door left closed so a farm can't accidentally lock itself out of its own settings.

The dashboard and the phone app show this differently, on purpose. On the dashboard, an action you're not allowed to take simply isn't shown — a viewer never sees an edit button in the first place. On the phone, the same locked action is shown but dimmed and un-tappable, with a line saying which account type it needs. That's deliberate: a worker standing in a barn has no way to ask "what am I missing?" if a capability is hidden entirely, so the phone shows what exists even when it can't be used yet.

## FAQ

**Is my farm's data shared with other farms using the same system?**
No. Every farm's data is walled off from every other farm's — you only ever see your own herd, records, and users.

**What happens if I forget to log something for a few days?**
Nothing breaks — the gap just shows up as a gap. If it goes on long enough (no weigh-in for a stretch), the system raises an alert so it doesn't go unnoticed indefinitely.

**Can two people use it at the same time?**
Yes, everyone with an account for that farm can be logged in and working at once, whether they're on the phone or the dashboard.

**What if the app says a hog's data can't be found?**
That usually means the hog doesn't exist, isn't part of your farm, or the link is wrong — it's a safe "nothing here" message, not a sign something is broken.

**Is this connected to the internet — could someone else see my data?**
It runs entirely on the farm's own computer — there's no cloud service involved. Nobody outside your farm's accounts can see your data. The phone app does need to reach that computer over the farm's own wifi to save anything; there's no working-offline mode. If it can't connect, it says so plainly and keeps whatever you'd already typed, so nothing has to be retyped once you're back in range.

**Why does it ask for a login? Who are the different account types?**
Login keeps each farm's data private and separates who can edit (manager and worker) from who can only view (viewer), and who can manage the farm's settings (manager only).

**What's the difference between the demo data and my real farm's data?**
The demo data is fake, generated for trying the system out — realistic-looking pigs, weights, and events, but invented. Your real farm's data is whatever you enter yourself, kept completely separate. New farms are set up ready to go for Nigeria by default — local time and currency — though nothing stops a farm elsewhere from being entered.

**Why was this built — is it a real product or a school project?**
It's a working demonstration built for an academic report — the goal was a genuinely usable farm tool, not just a mockup, but it isn't a shipped commercial product.

**Can I fix a mistake after entering a record?**
Records can be edited after the fact — you're not locked into whatever you first typed. That includes fixing a hog's recorded parents; the system checks that the change still makes sense (a mother must be female, a father male, an animal can't be its own parent, and a parent must have been born before its offspring) before it accepts it.

**Does the system flag problems automatically, or do I have to check myself?**
You don't have to check constantly — the system watches for things like unusual weight loss, an overdue vaccination, or a missing weigh-in, and raises an alert on its own. You can still browse any animal's full history yourself at any time.

**Do old records ever get deleted or lost?**
Records stay in the system; nothing is automatically deleted just for being old. Every record type, including vaccinations and mortality events, can also be downloaded as a spreadsheet for safekeeping or for sharing outside the system.

**Do I need a phone app, or is this all on a computer?**
Both exist now. The phone app is where day-to-day recording happens — weigh-ins, health checks, feed, vaccinations — plus a quick look at headline numbers and one weight chart per animal; anything deeper points you back to the dashboard, which is where the fuller analysis, charts, and farm settings live, from a computer browser in a dark or light colour scheme. One honest caveat: the phone app is finished — every screen has been built and tested in code — but it has not yet actually been opened on a real phone, so it hasn't been used in a real barn yet.
