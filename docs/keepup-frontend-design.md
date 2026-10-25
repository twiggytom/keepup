# KeepUp: a principled Figma workflow for the Cal Hacks Figma track

## Context
The Figma "Idea To Demo" track judges the **workflow**, not app scope. Its four criteria:
- Workflow Design: every stage covered, tools chosen on purpose.
- Adoptability: measurable friction removed.
- Output Quality: the demo works and is well designed.
- Pitch: the story is clear.

The two big prizes are Best Figma Workflow and Best Stage Log, $2000 each.

Starting point:
- The frontend already exists in code: React + Vite, 6 pages, tokens in `frontend/src/index.css`.
- The backend is owned by a partner and is growing (auth, profile, sessions routes).
- The user wants to do the design work by hand.

So the question is not "how do we use as much Figma as possible". It is "how does each Figma tool earn its place, and how does each stage's output visibly feed the next one".

## The selection principle (use this to decide any tool)
A Figma tool gets a stage only if it passes all three tests:
1. **Cheaper question:** it answers that stage's question faster or more cheaply than writing code would.
2. **Traceable output:** its output becomes the next stage's input, as a link, frame or variable, not a vibe.
3. **Loggable:** you can record minutes, a 1–5 rating and the friction you hit.

If a tool fails any test, skip it and say why in the log. Judges reward honest abandonment.

Stage → question → tool:
| Stage | Question it answers | Tool | Why not something else |
|---|---|---|---|
| Ideation | What's wrong with the current app for older adults, and what matters most? | **FigJam** (critique stickies on captured screens, plus the user journey) | Divergent thinking is cheapest on a whiteboard. Code can't hold critique. |
| Design | What should it look like? | **Figma Design**, by hand: variables, text styles, a few components | This is the user's own craft. Variables become the handoff contract. |
| Prototyping | Can a real person get through the flow? | **Figma prototype** for the click-through; **Make** only for live behavior a static prototype can't show | Make would duplicate the existing app, so use it only where motion or interaction is the question. |
| Handoff | How does the design become exact specs? | **Dev Mode + Figma MCP** (`get_design_context`, `get_variable_defs`) | Variables named to match the CSS tokens give a 1:1 trace. |
| Code generation | Make it real | **Claude Code reading Figma frames via MCP**, editing the existing pages | Reuses the current code. No throwaway generated app. |
| Pitch | Tell the story | **Figma Slides** with the prototype/Make embedded, plus the repo link | Required deliverable. |

## Workflow (in order)

**0. Baseline capture (Handoff, run in reverse): in progress**
- Finish the `generate_figma_design` capture of all 6 screens into [KeepUp — Frontend Design](https://www.figma.com/design/UudTZjaHfyu22Xe0WPI1ZG). The user captures each screen with the browser toolbar.
- Unblock first: the View seat. Confirm you can edit the file.
- Afterwards, remove the capture `<script>` from `frontend/index.html`.

**1. Ideation in FigJam (~30 min, user)**
- Paste the captured screens into a FigJam board.
- Put critique stickies on them: font size, target size, clarity during a test, the diagnostic-language rule.
- Map the journey for two personas: the older adult testing at home, and the clinician reading the PDF.
- Dot-vote down to **3–5 redesign goals**. Those goals are the traceable output.

**2. Design system foundations in Figma Design (~30 min, user)**
- Create variables that **mirror the `index.css` names**: `bg`, `surface`, `text`, `muted`, `primary`, `ok`, `warn`, `error`, `border`. Include light and dark modes.
- Create text styles (20px base, large headings) and 3–4 components: Button, Card, Stat/Score, Status pill.
- Matching names is what makes handoff traceable later.

**3. Redesign the screens by hand (user)**
- Priority is the order judges see them in the demo:
  1. TestRunner: live count, countdown, skeleton overlay
  2. Results
  3. Home
  4. History
  5. Onboarding
  6. Login
- Keep the hard rules from CLAUDE.md: wellness wording, "Demo data" label, large text.

**4. Prototype and test (~20 min)**
- Wire the frames into a click-through in prototype mode.
- Run a 5-minute test with a teammate or friend. Log what broke, then iterate once. That's the "loop back" judges ask to see.
- **Make: optional, one targeted use.** Prototype the live rep-count/countdown interaction, or the trend chart, only if the static prototype can't answer "does this feel right". If you use it, embed it in the Slides.

**5. Handoff and code, one screen at a time (Claude implements, user reviews)**
- For each finished frame:
  1. Claude calls `get_design_context` and `get_variable_defs`.
  2. Claude maps the variables to the existing `index.css` tokens.
  3. Claude edits the matching file in `frontend/src/pages/*.tsx`, reusing existing logic (`pose/`, `api/client.ts`) and changing only presentation.
  4. Claude compares the running app against `get_screenshot` of the frame.
- Code Connect: skip. Too much setup for 6 screens. Log that as a deliberate choice.

**6. Loop for each new backend feature**
- When the partner adds an endpoint: sketch in FigJam if it's unclear, design the frame, then hand it off to code.
- Each loop gets its own stage-log entry. This is the strongest traceability evidence.

**7. Slides and video (end)**
- Build a Figma Slides deck: the stage log (≤200 words per stage), the embedded prototype/Make, a before/after of the captured vs redesigned screens, and the repo link.
- Set every file to "Anyone can view".

## Adoptability evidence (measure as you go)
In `docs/STAGE_LOG.md`, record for each screen:
- minutes from design to working code
- number of rework rounds
- whether it was code-first (baseline) or design-first (redesign)

That gives the measurable before/after the judges ask for.

## Files touched later (not now)
- `docs/STAGE_LOG.md`: one entry per stage or loop.
- `frontend/src/index.css`: token values updated from the Figma variables.
- `frontend/src/pages/*.tsx`: presentation changes only.
- `frontend/index.html`: remove the temporary capture script.

## Verification
- Every redesigned screen has a Figma frame link next to its stage-log entry.
- The running app matches each frame, checked against `get_screenshot`.
- `npm test` passes in `frontend/`. The rep counter is untouched.
- All Figma files are "Anyone can view".
- Every stage in the log has a tool, the reason for it, minutes, a rating, its output, and friction.
