# How it works (non-technical)

## What is this?

A record-keeping and monitoring tool for a pig farm. It tracks each individual animal — its breed, sex, birth date, ear-tag number, and even its parents — plus the everyday events that happen to it: feeding, weighing, health checks, vaccinations, and breeding. Instead of paper logs or a spreadsheet per farm worker, everything lives in one place a manager can check at a glance.

## Who would use it

A farm manager who wants to see the whole herd's status without walking every pen, or a field worker recording what happened today. It's also, honestly, a demonstration project — built to produce a real, working system as evidence for an academic report, not (yet) a polished commercial product.

## What problem it solves

Paper records and spreadsheets scatter information across people and pens, and make it hard to see herd-wide trends — is the average weight gain on track? Is one hog falling behind? Nothing flags a problem until someone happens to notice it. This system keeps one shared, current picture of the herd and raises alerts automatically when something looks off.

## A day in the life

A manager logs in and lands on a dashboard: herd size, a growth trend chart, feed efficiency, and any open alerts. Clicking into one hog shows its full history — every weigh-in, feed record, health note — plus its vaccination record (how many doses, and whether one is overdue) and, if known, its mother and father. Adding a new animal or recording something that happened (a feed delivery, a vaccination, a health observation) takes a form and a submit button; the dashboard updates automatically. If a hog hasn't been weighed in a while, or its growth looks off, the system raises an alert on its own — nobody has to remember to check.

## Who sees what

Three kinds of accounts on a farm: a **manager**, who can record and edit everything and also manage the farm's settings — adding staff accounts, changing a colleague's role, and renaming the farm; a **worker**, who can record and edit day-to-day events (feeding, weighing, health, vaccinations, breeding) but can't touch settings; and a **viewer**, who can look but not touch anything — useful for showing a supervisor the numbers without letting them change anything. A manager can hand out worker or viewer accounts, but deliberately cannot create — or demote anyone down to — another manager account; that's a one-way door left closed so a farm can't accidentally lock itself out of its own settings.

## FAQ

**Is my farm's data shared with other farms using the same system?**
No. Every farm's data is walled off from every other farm's — you only ever see your own herd, records, and users.

**What happens if I forget to log something for a few days?**
Nothing breaks — the gap just shows up as a gap. If it goes on long enough (no weigh-in for a stretch), the system raises an alert so it doesn't go unnoticed indefinitely.

**Can two people use it at the same time?**
Yes, everyone with an account for that farm can be logged in and working at once.

**What if the app says a hog's data can't be found?**
That usually means the hog doesn't exist, isn't part of your farm, or the link is wrong — it's a safe "nothing here" message, not a sign something is broken.

**Is this connected to the internet — could someone else see my data?**
It runs entirely on your own machine — there's no cloud service involved. Nobody outside your farm's accounts can see your data.

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
Today it's a web dashboard used from a computer browser, available in a dark or a light colour scheme depending on what's easier on your eyes. A phone app is planned but hasn't been built yet — set your expectations there honestly.
