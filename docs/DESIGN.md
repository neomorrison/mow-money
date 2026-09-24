# Mow Money: Game Design

A lawn care empire game. You start with a push reel mower, a bicycle and $60. You knock on doors, haggle with homeowners, mow their lawns yourself in a 3D scene, and earn their loyalty with good work. Money buys better mowers, trucks and trailers. Reputation opens bigger properties. Eventually you hire crews, sales reps and managers until the business runs itself, then sell it for a legacy bonus and start again.

The numbers in this document are the source of truth for `src/sim`. When balancing changes a constant, update this file in the same change.

## 1. Pillars

1. **Mowing feels great.** Grass visibly falls under the deck, stripes follow your path, missed strips are obvious, the trimmer gets the edges the mower cannot reach. Real skill (clean lines, full coverage, no damage) earns real money.
2. **People are people.** Every homeowner has a personality, a budget they will not tell you, and a patience limit. Negotiation is a readable game of cues, not a coin flip.
3. **Consequences are fair and legible.** Quality drives satisfaction, satisfaction drives churn and referrals. Every formula below is smooth, bounded and shown to the player through meters and reasons ("Missed patches", "Grass was scalped").
4. **The empire grows out of the lawn.** Each tier of equipment and staff removes a chore the player has mastered, so the game shifts from hands-on mowing to management without ever forcing it.

## 2. Core loop

```
Morning (Hub) ──> pick jobs, assign crews, check forecast
   │
   ├─> Travel to a neighborhood (costs game minutes)
   │     ├─> Mow a client lawn: manual 3D job, or Autopilot once mastered
   │     └─> Knock on doors: pitch, negotiate, sign or get turned away
   │
   └─> End Day ──> crews finish routes, grass grows, clients pay, react,
                  churn or refer, wages and loans are paid, events roll
                  ──> Day Report ──> next morning
```

## 3. Time

| Item | Value |
|---|---|
| Day 0 | Year 1, Spring, day 1, Monday |
| Season lengths | spring 28, summer 28, fall 28, winter 14 (year = 98 days) |
| Workdays | Mon to Sat. Sunday: crews off, clients do not expect service, the owner may still work |
| Owner clock | 07:30 (450) to 19:30 (1170) = 720 minutes |
| TIME_SCALE | 0.2 game minutes per real second while mowing in 3D (12 game s per real s) |
| Travel | `minutes = 4 + 60 * km / vehicle.travelSpeedKmh` between neighborhoods, 3 min between houses in the same neighborhood |

Game minutes in a manual job = real seconds spent mowing * TIME_SCALE, plus a fixed setup of 6 minutes. This keeps manual and simulated jobs on the same clock.

## 4. Grass

Grass height `h` is tracked in inches per client property, once per day:

```
dh = G[season] * W[weather] * F * (1 - h / 12)
G = { spring: 0.36, summer: 0.26, fall: 0.22, winter: 0 }
W = { sunny: 1.0, cloudy: 1.1, rain: 1.35, storm: 1.25, heat: 0.55 }
F = 1.15 with the fertilizer add-on, else 1
```

Weekly spring service from 3.0 in reaches about 4.8 in (37 percent removal). Biweekly spring service reaches about 6.3 in (52 percent removal) and triggers the stress penalty below, which is the design pressure behind frequency and deck height.

Non-client lawns are not saved. Their height is a pure function of `(houseSeed, day)`: each owner mows on their own cycle (DIY every 7 to 14 days, neglectful archetypes every 12 to 21 days), so the map always shows plausible overgrown and neat lawns.

**The one-third rule.** Cutting away more than about 40 percent of blade height at once stresses the lawn. `removedFraction = 1 - cutHeight / hBefore`. Stress penalty in quality: `60 * max(0, removedFraction - 0.40)` points. Players avoid it by raising the deck (Q/E in the 3D scene) on overgrown lawns.

In the 3D scene each lawn cell starts at `h * (1 + 0.22 * noise)` with a few faster growing patches (shade or wet spots, up to +35 percent). A mower whose `maxGrassIn` is below the cell height only cuts that cell halfway toward the deck height (the grass gets pushed over), so tall grass needs a second pass or a bigger mower.

## 5. Weather

Daily Markov chain per season. Row = today, columns = tomorrow (sunny, cloudy, rain, storm, heat):

| Season | sunny | cloudy | rain | storm | heat |
|---|---|---|---|---|---|
| spring base | 0.40 | 0.28 | 0.24 | 0.06 | 0.02 |
| summer base | 0.46 | 0.18 | 0.10 | 0.08 | 0.18 |
| fall base | 0.38 | 0.32 | 0.22 | 0.05 | 0.03 |
| winter base | 0.30 | 0.50 | 0.15 | 0.05 | 0.00 |

Persistence: tomorrow = today with probability 0.35, otherwise a draw from the base row. The forecast shows the next 3 days and is pre-rolled, so it is exact. Rain: the owner may mow, but grass is wet (clumps, -6 quality, 15 percent slower). Storm: crews do not work, and postponed jobs carry no lateness penalty that day. Three or more heat days in a row set `drought`, which multiplies growth by 0.6 until rain.

## 6. Prices

Market fair price per mow for a lawn of `A` square feet (lawn only, not the lot):

```
fair(A) = 20 + 0.052 * A^0.725              (weekly service)
biweekly = fair * 1.20                      (taller grass, fewer visits)
commercial = fair * 1.15                    (parks too; golf fairways fair * 2.5, mowed like three visits)
```

Examples: 3,800 sq ft = $41, 11,000 = $64, 22,000 = $93, 43,560 (1 acre) = $140. Sublinear on purpose: big lawns are cheaper per square foot, matching real pricing and rewarding productive equipment.

Add-ons (multiply the per-mow price): bagging +12 percent, premium stripes +10 percent (the client then expects a stripe score of at least 0.7), fertilizer program +8 percent (growth x1.15, satisfaction +2 per visit for enthusiasts).

Displayed area is square feet: `sqft = m2 * 10.764`.

## 7. Homeowners

Every house gets an archetype, a portrait, a name and hidden values from its seed (see `src/data/archetypes.ts` for the table).

```
wealth w   ~ U(hood.wealth range) * archetype.wealthMult
need       = 1.0, x1.12 if the lawn is over 5.5 in, x1.2 under an HOA letter, archetype.needMult
V          = fair(A) * w * need * LogNormal(0, 0.08)        reservation value per weekly mow
E          = archetype.expect + U(-5, 5)                     quality expectation (55 to 95)
patience   = archetype.patience + {-1, 0, +1}                negotiation rounds
anchor     = archetype.anchor + U(-0.05, 0.05)               opening counter as a fraction of R
```

Answer probability when you knock depends on the archetype's `home` profile (day 08:00 to 17:00, evening 17:00 to 19:30) and on weekends (x1.3, capped at 0.95). Warm leads answer at least 85 percent of the time. Before 09:00 the chance is halved. A knock costs 4 minutes (2 with the Door Pro perk).

Not everyone who opens the door wants a service. Before the pitch starts, a DIY owner turns you away with `pNo = clamp(0.65 - 0.12 * (h - 3), 0.10, 0.70)` where `h` is their grass height (tall lawns are the best prospects), a rival's client with 0.40 (budget rival) or 0.55 (premium rival), and warm leads or HOA-letter houses with 0.05. A refusal makes the house cold for 3 days. A rejected pitch blocks a second pitch the same day.

`PitchContext.house.V` already includes the situational need multipliers above (over 5.5 in, HOA letter).

## 8. Negotiation

State: trust `T` in [0, 1], patience `p`, round `k`, mood.

```
T0 = 0.35 + 0.10 * (reputation - 3) + 0.25 * [referral or warm lead]
     + 0.05 * min(3, clients on the same street) + perks
R  = V * (0.85 + 0.30 * T)                  price at which acceptance is 50 percent
```

1. **Opener.** Four tones: Friendly, Professional, Direct, Funny. Archetype affinity per tone is -1, 0 or +1: `T += 0.12 * affinity`.
2. **Talking points.** Up to two, chosen from the ones that apply: overgrown lawn (need x1.1 if h > 5, trust -0.10 if h < 4), neighbor social proof (needs a client on the street, T +0.08 per client up to 3), reputation (T += 0.06 * (stars - 3.5)), free first mow (unlocks the trial close), eco mowing (reel or electric equipment, big bonus for the Eco archetype), beat your current service (if their provider is a rival with low quality, need x1.1).
3. **Offer.** The player sets a price and a frequency. With `r = P / R`:

```
pAccept(r) = 1 / (1 + exp((r - 1) / 0.035))
```

   r = 0.90 accepts 95 percent of the time, r = 1.00 half, r = 1.10 5 percent. If rejected, patience drops by 1, and the reaction reveals a bucket: r > 1.4 offended (T -0.15, patience -1 more), 1.15 to 1.4 "too steep", 1.0 to 1.15 "close". Then they counter:

```
counter_k = R * (anchor + (0.97 - anchor) * (1 - 0.55^k))
```

   Counters climb toward 0.97 R, so patient players who read the cues get close to the reservation price and greedy players lose the deal. Accepting a counter always closes.
4. **Trial close.** If "free first mow" was mentioned, the player may propose a trial at the current price. The first job is unpaid, and the contract signs if that job's quality is at least `E - 5`.
5. **Out of patience.** "I'll think about it." The house goes cold for 5 days.

Frequency: an archetype that prefers biweekly values weekly service at 0.9 V, and vice versa. On a deal: `client.price = P`, `client.R = R`, starting satisfaction `S0 = 60 + 20 * T`.

The UI shows the neighborhood fair price as a hint. The Read the Room perk shows the mood bucket for every offer before you commit, and Silver Tongue adds 0.08 trust.

## 9. Quality

The 3D job returns raw measurements (`MowJobResult`). Quality `Q` in [0, 100]:

```
stripeTerm = wantsStripes ? stripe : max(stripe, 0.7)
Qraw = 100 * ( 0.50 * coverage^3
             + 0.14 * evenness
             + 0.12 * trim
             + 0.08 * cleanup
             + 0.10 * stripeTerm
             + 0.06 * (1 - clumps) )
Q = min(mower.qualityCap, Qraw * (0.88 + 0.12 * sharpness))
    - 60 * max(0, removedFraction - 0.40)       stress
    - 6 if the grass was wet
    - 8 * max(0, |cutHeight - targetIn| - 0.5)      cut too high or too low (inches)
    - sum(damage.points)                        flower bed 6, gnome 4, sprinkler 5, toy 2, fence 5
clamped to [0, 100]
```

Coverage counts lawn cells whose final height is at most the deck height used + 0.5 in, so raising the deck on an overgrown lawn trades the stress penalty for the height mismatch penalty (and an easier next visit). Clients state their preferred height `targetIn` (2.5 to 3.5 in residential, 1.5 to 2.5 commercial, 0.5 on golf fairways).

Coverage is cubed on purpose: 95 percent coverage gives 0.857 of that term, 90 percent gives 0.729. Missing a tenth of a lawn is what clients notice first.

Star rating for reputation: `stars = clamp(1 + 4 * (Q - 40) / 50, 1, 5)` (Q 90 is five stars, Q 80 is 4.2, Q 70 is 3.4).

**Autopilot** (owner, simulated job): allowed after one manual job on the property. `Q ~ Normal(min(cap, bestManualQ - 3 + perkBonus), 4)` with the same stress and wet penalties. Crew jobs: `mu = min(cap, 58 + 40 * skill/100 * moraleFactor)` (+4 with a crew lead, +3 with a Perfectionist, -8 without a trimmer, -4 without a blower, -10 * (1 - sharpness), -10 * max(0, 0.7 - stripe) for clients who want stripes), `sigma = 12 - 8 * skill/100`, `moraleFactor = 0.85 + 0.15 * morale/100`, where skill weights a crew lead double. Autopilot and crews raise the deck on overgrown lawns to stay under the one-third rule and take the height mismatch penalty instead.

## 10. Satisfaction, churn, referrals, reputation

Per completed service:

```
target = clamp(70 + 1.5 * (Q - E), 0, 100)
S = S + 0.40 * (target - S)
S -= 12 per damage incident
```

Doing exactly what they expect settles a client at 70 (content). Ten points above settles at 85 (delighted). Twenty below settles at 40 (at risk).

Lateness: a job is due on `nextDueDay` with a one day grace. Each day after that: `S -= 3 + 3 * (E - 60) / 35`. Storm days are forgiven.

Price above value: each week, `S -= 15 * max(0, price / R - 1)`.

Churn is a daily hazard derived from a weekly one:

```
hWeek(S) = 0.6 / (1 + exp((S - 35) / 7))
hDay = 1 - (1 - hWeek)^(1/7)          x1.3 if a rival is active in the neighborhood
```

S = 70 loses 0.4 percent a week, S = 55 3.4 percent, S = 40 20 percent, S = 25 48 percent. The client card shows the weekly risk.

Referrals: each week each client has `p = 0.10 * clamp((S - 72) / 28, 0, 1) * (1 + 0.5 * yardSign)` to create a warm lead at a non-client house in the same neighborhood (T +0.25 in the pitch).

Tips: when `Q >= E + 8`, `P(tip) = min(0.6, 0.25 + 0.02 * (Q - E - 8))`, amount `price * U(0.10, 0.25) * archetype.tipMult`.

Reputation is a Bayesian average of recent stars with a 3.0 prior worth 5 ratings and recency weight 0.98 per rating, over the last 60 ratings:

```
rep = (5 * 3.0 + sum(w_j * stars_j)) / (5 + sum(w_j)),   w_j = 0.98^age_j
```

A steady Q of 80 settles near 4.05, Q 85 near 4.45, Q 90 near 4.75.

## 11. Leads and marketing

Organic leads per day per unlocked neighborhood: `Poisson(lambda)`, `lambda = hood.baseLeads * (0.5 + rep / 5) * (1 + boost)`. Leads last 7 days and give T +0.15.

Marketing boost with diminishing returns, per neighborhood, active 14 days: `boost = 0.6 * ln(1 + spend / 200)`. Flyers cost $80 per 100, door hangers $150, a local newspaper ad $400 (all neighborhoods of a town at half effect), yard signs are free for clients who agree (70 percent if S > 70) and add 0.05 to their street's lead rate.

## 12. Equipment

See `src/data/equipment.ts` for the full table. Productivity:

```
rate (m2 per game minute) = deckWidth * speed * 0.75 / TIME_SCALE
jobMinutes = 6 setup + area / rate + trimMinutes + blowMinutes
trimMinutes = (3 + area / 250) * tool   (hand shears 1.6, string trimmer 1, pro trimmer 0.5, none 2.5)
blowMinutes = (2 + hardscape / 120) * tool   (push broom 1.5, blower 1, backpack 0.7, none 2)
mowing takes x1.5 when the grass is taller than the mower's maxGrassIn, everything x1.15 on wet grass
```

With two or more crew members, trimming and blowing overlap the mowing: `6 + max(mow, trim + blow)`.

Wear: blade sharpness drops `0.05 * wearMult` per 1,000 m2 cut (exported as `BLADE_WEAR_PER_1000`). Sharpening costs $6 and 15 minutes at the HQ, or is free overnight with a mechanic or sharpening station. Condition drops 0.002 per engine hour. Breakdown chance per job `= (1 - reliability) * (1.5 - condition)`, repair `= 0.08 * price * (1.2 - condition)`, and the job is lost for the day.

Fuel: `fuelGalPerHr * hours * fuelPrice`. Fuel price starts at $3.60 and moves by a weekly random walk (sigma 4 percent, clamped $2.80 to $5.20).

Transport: the vehicle's `capacity` must cover the `transportSize` of the carried mowers (bicycle trailer 1: push mowers only; pickup bed 2; pickup with trailer 6; crew truck with trailer 10; box truck 14).

## 13. Neighborhoods

| id | name | lawn m2 | wealth | houses | km from HQ | unlock |
|---|---|---|---|---|---|---|
| maple | Maple Grove | 260 to 420 | 0.85 to 1.10 | 48 | 0.5 | start |
| oak | Oak Hills | 480 to 900 | 1.00 to 1.25 | 56 | 3 | rep 3.4 and 4 clients |
| willow | Willow Creek Estates | 1,400 to 3,000 | 1.30 to 1.80 | 32 | 7 | rep 3.9, a truck |
| heritage | Heritage Hills | 2,500 to 5,000 | 1.80 to 2.60 | 24 | 12 | rep 4.3, a riding mower |
| pinecrest | Pinecrest Business Park | 3,000 to 6,000 | commercial | 14 | 9 | rep 4.0, insurance, 1 crew |
| parks | Civic Parks and Fields | 8,000 to 15,000 | municipal | 8 | 6 | rep 4.2, wide-area mower |
| links | Fairway Links Golf Club | 20,000 | premium | 1 | 15 | rep 4.5, gang reel mower |

Neighborhoods are big on purpose: a hard-working owner can serve about 100 weekly lawns alone, so crews only pay off once the market is larger than one person.

Commercial, municipal and golf properties are won through bids (section 15), not door knocking.

Branches: once the home town is well served, the player can open a branch in a new town (Riverside $60,000, Cedar Falls $150,000, Summit Ridge $400,000). A branch is a new set of the same neighborhood templates with new seeds. Branch towns need an Operations Manager because the owner cannot commute there daily.

## 14. Staff

Roles, market wage per hour for skill `s` in [0, 100]:

| Role | Wage | Job |
|---|---|---|
| operator | 15 + 0.12 s | mows on a crew |
| lead | 18 + 0.14 s | crew lead, +4 quality, can drive the truck |
| sales | 16 + 0.12 s + 8 percent commission on first-month revenue | knocks doors in an assigned neighborhood |
| mechanic | 20 + 0.12 s | sharpens and repairs overnight, breakdowns x0.4 |
| office | 17 + 0.10 s | dispatches due jobs to crews every morning, +2 percent collected revenue |
| manager | 30 + 0.20 s | Operations Manager: hires replacements, buys fuel, runs branches |

Paid 10 hours per workday. Crews are a vehicle, a mower, a trimmer and a blower plus one or more members, one of them a lead or the owner. Crew daily capacity is 600 minutes minus travel, jobs sorted by overdue first, then by neighborhood.

Morale drifts 10 percent per day toward `60 + 1.2 * (wage - marketWage) + 10 * recentRaise - 8 * overtimeDays`. Weekly quit chance `0.25 / (1 + exp((morale - 30) / 6))`. No-show chance per day `(1 - reliability) * 0.5`. Skill grows `(100 - skill) * 0.0005` per job (x2 with the Trainer perk; sales reps grow 4x that per signed client), so a crew member closes about a third of the gap to 100 in a busy season. Wages follow skill, so good people ask for raises.

Sales rep daily: 30 knocks, answers at the neighborhood's average rate, close chance `0.08 + 0.22 * skill/100 * rep/5 * remainingShare`, price `V * (0.88 + 0.20 * skill/100) * LogNormal(0, 0.05)`.

The hiring board refreshes every Monday with 4 to 6 candidates (portrait, traits such as Perfectionist, Speedy, Chatty, Unreliable, Veteran). A job posting costs $40.

## 15. Rivals and bids

Each town has two rivals, a budget outfit (price index 0.85, quality 68) and a premium one (1.15, 86). 20 to 35 percent of each residential neighborhood starts with a rival. Rival clients start at T -0.10 but the "beat your current service" point works on the budget rival. Lost clients go to a rival (60 percent) or back to DIY. A rival active in a neighborhood multiplies churn by 1.3 for clients below S = 55.

Bids: each unlocked commercial or municipal neighborhood posts a request for proposal with weekly probability 0.3 (golf: one 12-week contract a year, posted in spring). Term 12 to 26 weeks (counted on Sundays outside winter), weekly service, closes in 3 days. Each rival bids `fairCommercial * rival.priceIndex * LogNormal(0, 0.08)`. The award goes to the lowest `bid / (1 + 0.12 * (rep - 3.5))`. A won contract terminates after three consecutive services with Q < 70.

## 16. Finance

- Loans: limit `2000 + 0.5 * equipmentBookValue + 4 * avgWeeklyRevenue(last 4 weeks) - debt`. APR 9 percent (7 percent at rep 4.5 or better, -2 points with the Negotiator perk). Weekly payment `L * i / (1 - (1 + i)^-n)`, `i = APR / 52`, `n` in {13, 26, 52}.
- Insurance: required before the first hire or commercial bid. $30 per week plus $10 per employee. Damage claims above a $100 deductible are covered.
- Taxes: at each season end, 15 percent of positive season profit.
- Book value: purchase price * 0.92 per season owned. Resale at 80 percent of book value.
- Valuation: `max(0, annualProfit) * (2 + 0.5 * rep + retention) + bookValue + cash - debt`, where annual profit is the operating net of the trailing 98 days once a full year of history exists (before that, the last 28 days extrapolated to 98), and retention is the share of clients kept over the last 28 days.
- Operating profit excludes equipment purchases and sales, loan principal and branch costs. Loan interest counts.
- Negative cash costs an overdraft fee of 0.1 percent a day (at least $2).

## 17. Owner progression

XP: a manual job gives `Q / 5`, an autopilot job `Q / 20`, a deal 25, a won bid 60. Level `L` needs `100 * L^1.5` total XP. One skill point per level.

| Tree | Perk | Effect |
|---|---|---|
| Sales | Silver Tongue | +0.08 trust in pitches |
| Sales | Read the Room | see the mood bucket before offering |
| Sales | Closer | +1 patience |
| Sales | Door Pro | knocks take 2 minutes, answer rate +10 percent |
| Craft | Straight Lines | +0.10 stripe score |
| Craft | Edge Master | trimmer radius +30 percent |
| Craft | Autopilot Pro | +5 autopilot quality |
| Craft | Quick Feet | +10 percent manual speed |
| Management | Motivator | +10 morale target |
| Management | Trainer | skill growth x2 |
| Management | Dispatcher | travel time -20 percent |
| Management | Bulk Buyer | equipment -10 percent |
| Management | Negotiator | loan APR -2 points |

## 18. Seasons

- Fall: every job has leaves on the lawn (cleanup counts leaf removal). Leaf cleanup is a one-off service at `0.9 * fair` per visit.
- Winter: no growth and no mowing. Contracts pause. Staff can be laid off for the season (no wages, 70 percent return in spring, more with high morale). Equipment overhaul restores condition at 50 percent of repair cost. "Skip to spring" fast-forwards and pays fixed weekly costs.
- Spring renewal: each client renews with probability `(1 - hWeek(S))^2`. A price raise at renewal is accepted if the new price is at most R, costing `S -= 40 * raise%`.

## 19. Legacy (prestige)

"Sell the company" at any time after year 1 converts valuation into legacy points `floor(sqrt(valuation / 10000))`. Legacy perks carry into new games: Seed Money (+$1,500, 1 point), Local Legend (start near 3.8 reputation, 2), Head Start (+1 skill point, 1), Fleet Discount (first truck -25%, 2), Gas Start (a gas push mower, 1), Quick Knocks (knocks take one minute less, 1).

## 20. Presentation rules

- UI copy follows docs/COPY.md: product voice, short labels, no em dashes, no exclamation marks in system text (homeowners may exclaim in dialogue), no emoji in UI chrome.
- Every penalty has a reason string the player can read.
- Touch controls exist for everything (the owner plays on an iPad).

## 21. Implementation notes (sim)

- **Owner clock.** `owner.minute` runs from 450 to 1170. Every action that costs time (travel, knock, pitch, job, sharpening) is refused with "Not enough daylight." when it would pass 19:30. Knocking opens at 08:00 (the tutorial neighbor excepted). End Day resets the clock to 07:30 at the HQ.
- **Transport.** The owner's vehicle capacity must cover the owner's mower `transportSize`, otherwise manual and autopilot jobs are refused. The bicycle carries push mowers only. New mowers join the kit when they beat the current mower and fit the vehicle; otherwise they wait in the garage.
- **Due jobs.** A client is due from `nextDueDay - 1` (one day early allowed). `daysOverdue = max(0, today - nextDueDay - 1)`. Sundays and storm days carry no lateness penalty. Winter pauses every contract until spring day 1.
- **Grass.** Client lawns are tracked in the save and grown each night with that day's weather. Other lawns are a pure function of the house seed and the day (DIY cycle, rivals every 7 days), so they are never saved.
- **Crews.** A crew needs at least one member, a mower and a vehicle that can carry it. Capacity is 600 minutes a workday including travel from the base and back. The office manager dispatches the owner's leftover due jobs to crews at End Day; without one, the player assigns jobs.
- **Tutorial.** `flags.tutorial`: 1 knock on Rose Albright (101 Maple Ln, a warm lead with a 5 in lawn), 2 mow her lawn, 3 knock three doors, 4 end the day, 0 done.
- **End Day order.** Crews, sales reps, grass growth, lateness, churn, leads, Sunday items (referrals, price check, contract terms, quits), wages, morale, Monday items (hiring board, loans, insurance, fuel price), bids, events, overnight maintenance, overdraft, season change (taxes, winter pause, spring renewal), weather, unlocks, summary, next morning.
