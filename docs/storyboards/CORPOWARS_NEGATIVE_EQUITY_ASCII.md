# CORPOWARS: NEGATIVE EQUITY
## ASCII storyboard — PUBLIC GAME-TEAM HANDOFF (v0.1)

> **Status:** proposed companion-fiction direction, **not** approved game canon.
> **Purpose:** pass a coherent espionage/action arc to the game-package author without releasing the prose short story.
> **Disclosure:** this public storyboard excludes the full prose manuscript, its dialogue, and the final dramatic resolution.
> **Integration:** additive reference only. No game source, assets, CI, build scripts, release tags, or existing missions are changed by this branch.
> **Compatibility:** anchors to CorpoWars + CorpoWars3d as inspected on 2026-11-05. The separate upgrade effort may have newer content; its author must reconcile differences before promoting anything to canon.

### Pitch

The city belongs to whoever owns its debt. Four corporate defectors learn that
the ledger is not merely financial: a chain of shell companies has classified
living people as transferable collateral. One routine contract becomes a
citywide espionage campaign to expose the ownership chain before the corporate
board executes its midnight "reconciliation."

Working title: **NEGATIVE EQUITY**. Genre: corporate espionage / neon-noir squad
action. Tone: hard-boiled, sardonic, fast, human; independent fictional universe.

### Anchors that exist in the games (KEEP)

- **SQUAD:** VEX = point; NULL = breach; ECHO = recon; IRON = support.
- **CAMPAIGN:** Hostile Takeover / Breakwater; Ghost Shift / Blackglass Foundry;
  Boardroom Blackout / Meridian Spire; Signal Siege / Copperline Grid;
  Witness Protection / Cold Storage; Golden Parachute / Obsidian Exchange.
- **VERBS:** relay -> proof -> extraction; stationary terminal hacking;
  tactical follow / hold / focus fire; swap between autonomous squad members;
  EMP / medical support / Panic; guards, Bulwarks and Marksmen.
- **CONSTRAINTS:** Panic makes enemies retreat, not join the squad.
  The courier's survival is essential. Copperline needs twelve uncontested
  transmitter seconds. Obsidian Exchange has a lockdown timer.
- **FORMATS:** isometric CorpoWars, tactical FPS CorpoWars3d, and the DOS
  demake "Dividend Zero" are different game presentations, not new canon.

### Proposed fiction only — NOT currently implemented features

- **DEBT SEED:** a signed obligation that outlives its debtor.
- **THE CHAIR:** pseudonym for the hidden beneficiary of the corporate chain.
- **MARA VALE:** provisional identity of the Cold Storage courier.
- **THE LAST RECEIPT:** proposed evidence proving the chain fraudulent.
- New villain dialogue, reveal timing, side missions, interactables,
  cinematics and endings are story concepts, not claims about game content.

### Public ASCII storyboard

~~~text
+-----------------------------------------------------------------------------+
| 00 / COLD OPEN — "AUTOMATED CORRECTION"                                     |
+-----------------------------------------------------------------------------+
| [Rain]              [Public debt ticker]          [A lone civilian]         |
|       . . .        +--------------------+           O                     |
|   ___|____|___     | HUMAN ASSETS       |          /|\    [SECURITY]        |
|  |  OVERPASS  |    | RECONCILE: 00:00   |          / \      ><             |
|  |____________|    +--------------------+                                  |
|                                                                             |
| A routine collection becomes a disappearance. One receipt remains.        |
| SFX: dry receipt printer -> hard silence -> distant rotary thunder.         |
+-----------------------------------------------------------------------------+

                | The receipt points to Breakwater
                v

+-----------------------------------------------------------------------------+
| 01 / BREAKWATER — HOSTILE TAKEOVER                                         |
+-----------------------------------------------------------------------------+
|      [SQUAD]                [RELAY]                     [LEDGER]           |
|       V N E I   ----->     [####] -X-   ----->          [$$$$]            |
|          \____ alley /       ^                              |             |
|  CCTV ---      \         EMP/stealth                  ACCOUNT: PERSON      |
|                                                                             |
| A debt seizure turns into theft of a human-ownership ledger.               |
| VEX says "Move"; ECHO asks who can afford the debt.                        |
| GAME HOOK: first terminal -> second objective -> complete squad extract.   |
+-----------------------------------------------------------------------------+

                | Unlock worker-custody chain
                v

+-----------------------------------------------------------------------------+
| 02 / BLACKGLASS FOUNDRY — GHOST SHIFT                                     |
+-----------------------------------------------------------------------------+
|   [FURNACE]             [ALARM]                [RELEASE-CODE VAULT]          |
|   ~~~~~~~~~              [!!]  -X-             +----------------+          |
|   ==========  <-workers-> ||    ----->          |  FREE / OWNED  |          |
|   ~~~~~~~~~                                     +----------------+          |
|                                                                             |
| Worker release codes also expose synthetic debt assignments.              |
| Question: steal the codes quietly or leave a path for the workers?         |
| GAME HOOK: north insertion; silence alarm; codes; southern freight exit.   |
+-----------------------------------------------------------------------------+

                | The parent company sits on Meridian's board
                v

+-----------------------------------------------------------------------------+
| 03 / MERIDIAN SPIRE — BOARDROOM BLACKOUT                                  |
+-----------------------------------------------------------------------------+
|     [GLASS TOWER]            [SHIELD]             [OWNERSHIP REGISTRY]      |
|         /\                    /XX\                 +----------------+       |
|        /  \   ---- breach -->/____\ -- hack -->   | OWNER: [MASKED] |      |
|       /____\                                      +----------------+       |
|                                                                             |
| A shell-company loop: each subsidiary owns the next, the last owns the     |
| first. One hidden signature sits outside the circle.                       |
| GAME HOOK: east breach; executive shield; registry; west service exit.     |
+-----------------------------------------------------------------------------+

                | One stolen record cannot clear the city
                v

+-----------------------------------------------------------------------------+
| 04 / SAFEHOUSE — "THE NOISE BETWEEN SHARES"                               |
+-----------------------------------------------------------------------------+
|  +------------+       +----------------+       +------------------+        |
|  | VEX: route | <---> | ECHO: evidence | <---> | IRON: casualty  |        |
|  +------------+       +----------------+       +------------------+        |
|          \                   |                         /                   |
|           \________ NULL: breach / no compromises ____/                    |
|                                                                             |
| Publish verifiable proof, not a manifesto. Team conflict and bond.         |
| EXPANSION SLOT: upgraded headquarters / new level / optional briefing.    |
+-----------------------------------------------------------------------------+

                | Get the proof onto a public carrier
                v

+-----------------------------------------------------------------------------+
| 05 / COPPERLINE GRID — SIGNAL SIEGE                                       |
+-----------------------------------------------------------------------------+
|    SECURITY --->    [ TRANSMITTER ]     <--- SECURITY                      |
|       M             | 12 SEC HOLD |          B                             |
|   [roof]----->  V / E / I / N  <----- [street]                              |
|                      \     /                                                |
|                       \___/    BROADCAST: evidence, not propaganda         |
|                                                                             |
| Two waves contest the zone. The signal gets out; recipients remain masked. |
| GAME HOOK: restore carrier -> defend 12 clear seconds -> NE exit.          |
+-----------------------------------------------------------------------------+

                | Locate the witness with the missing signature
                v

+-----------------------------------------------------------------------------+
| 06 / COLD STORAGE — WITNESS PROTECTION                                    |
+-----------------------------------------------------------------------------+
|   [CRYOLOCK]       [CELL]                 [TRANSFER GATE / WEST]             |
|      [##] ---> [  ?  ] ---> [ M + HARD CASE ] ---> [EXIT]                  |
|                   ^                  \____ squad escort ____/              |
|          Bulwark shield + long-range Marksman crossfire                     |
|                                                                             |
| Courier is a person, not equipment. ECHO offers a choice; she walks.       |
| GAME HOOK: disable cryolock -> release -> courier + survivors extract.     |
+-----------------------------------------------------------------------------+

                | Witness names an escrow at the exchange
                v

+-----------------------------------------------------------------------------+
| 07 / OBSIDIAN EXCHANGE — GOLDEN PARACHUTE                                  |
+-----------------------------------------------------------------------------+
|  [FAILSAFE] -X-  =======>  [SEVERANCE FUND] ===> [NW EXTRACTION]             |
|                           ________________                                  |
|  LOCKDOWN: T - ???       |?  ?  ?  ?  ?   |        CAMERA / MARKSMAN        |
|                         |________________|                X               |
|                                                                             |
| Theft is easy compared with knowing who is harmed when escrow clears.     |
| GAME HOOK: failsafe -> fund -> north-west exit before lockdown.            |
+-----------------------------------------------------------------------------+

                | The last operation is a choice, not a boss statistic
                v

+-----------------------------------------------------------------------------+
| 08 / AFTERMATH — "BALANCE FORWARD"                                         |
+-----------------------------------------------------------------------------+
|                 +------------------------------------------+                |
|                 | PUBLIC RECEIPT: VERIFIED / [REDACTED]   |                |
|                 +------------------------------------------+                |
|                         V   N   E   I                                     |
|                      Four bodies. One conscience.                          |
|                                                                             |
| *** PRIVATE MANUSCRIPT WITHHOLDS: final reveal, exact resolution,         |
|     climactic dialogue and closing image.                                  |
|                                                                             |
| Suggested game epilogue: consequence in the streets, not a lecture.       |
+-----------------------------------------------------------------------------+
~~~

### Integration instructions for the other game-building instance

1. **No code touch in this branch.** This file is the entire GitHub deliverable.
   Cherry-pick nothing else from the branch.
2. **No forced canon.** Compare against newer game content. Rename, reorder or
   replace proposed antagonist/witness/plot devices. The upgrade instance is
   authoritative for its current game, pending the owner's approval.
3. **No promised features.** Scene, cinematic, dialogue, objective, enemy and
   new location references above are story suggestions unless already in code.
4. **Insertion seams.** Panel 04 = safehouse/new mission. Between 06 and 07 =
   witness intelligence/new mission. After 08 = later expansion. Additional
   levels slot there without rewriting the six original contract names.
5. **Music cues, not tracks.** Static/rain; mechanical pulse; silence before
   breach; rising four-voice motif in Copperline; closing receipt motif.
   The owner plans to produce the actual bonus music separately.
6. **Keep prose private.** Full story is a customer-only companion manuscript
   transferred directly to the package owner, not to public GitHub, GitHub
   Actions, Pages, PR descriptions, release notes, fixtures or screenshots.
7. **No merge/publish.** Storyboard branch does not authorise merging,
   deployment, release, tagging or publication of a Payhip product.
8. **Handoff validation.** Compare newer missions, role names, enemy roster,
   package structure, soundtrack plan and story continuity before adoption.
   Report mismatches explicitly; do not silently overwrite newer work.

### Optional flavour text

- "OWNERSHIP IS A SERVICE. UNREST IS A PREMIUM FEATURE."
- "NO PERSONNEL WERE TRANSFERRED. ASSETS WERE REASSIGNED."
- "Someone has been asking who signs the receipts."
- "Payroll is going to be extremely upset."

### Source and distribution scope

Grounded in the public QSOLKCB/CorpoWars field manual and campaign data,
QSOLKCB/CorpoWars3d README/campaign, and DOS Dividend Zero README.
New devices above are proposed original companion fiction. This document
is deliberately public within the repository's Apache-2.0 context.
It is not the unreleased prose story.
