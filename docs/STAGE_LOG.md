# Stage log

Required for the Figma track. Write each entry as you go; summarize into the Figma Slides deck at the end (200 words max per stage).

Stages: Ideation, Prototyping, Handoff, Code generation.

Format:
## YYYY-MM-DD HH:MM — Stage: what you did
- Tool: which Figma product (Design, Make, agent/MCP, Slides) and why
- Minutes:
- Rating (1–5):
- Output → project: how it made it into the code
- Friction: rework, dead ends, abandoned tools

## 2026-10-24 — Code generation: working frontend built in code first
- Tool: none (React + Vite, written in code before any Figma work)
- Minutes:
- Rating (1–5):
- Output → project: core screens (login, onboarding, home, test, results, history) working against the FastAPI backend.
- Friction:

## 2026-10-24 — Handoff (code → design): captured running app into Figma
- Tool: Figma MCP `generate_figma_design` via Claude Code, to get editable baseline frames of the existing screens instead of redrawing them by hand.
- Minutes:
- Rating (1–5):
- Output → project: baseline frames in "KeepUp — Frontend Design" (https://www.figma.com/design/UudTZjaHfyu22Xe0WPI1ZG) used as the starting point for the redesign.
- Friction:

## 2026-10-24 — Prototyping: explored screens not yet designed in Figma
- Tool: Claude Design canvas (outside Figma). The Figma redesign covered setup, home, onboarding and the empty history; the test-in-progress, results and history-with-data screens had no design yet. Used it to get high-fidelity directions fast, reusing the Figma redesign's colors, cards and buttons so the result fits next to it. Atkinson Hyperlegible chosen for low-vision readability.
- Minutes:
- Rating (1–5):
- Output → project: 3 screens generated (test in progress, results, history with trend chart). Then iterated by hand on the canvas and added 4 results-graph variants (gauge, trend line, pace within the test, doctor report). Picked the gauge (score vs CDC guide with last-test marker) because it needs only data the app already has.
- Friction: not a Figma tool, so this stage is not traceable inside the Figma file; the designs reached the code through an exported handoff folder instead of Figma frames. All numbers are sample data and labelled as such.

## 2026-10-24 — Handoff: exported design folder with a spec
- Tool: Claude Design export (`keepup-design/`): one `.dc.html` source per screen plus a HANDOFF.md with the visual system (font, colors, sizes, chart rules) and domain notes.
- Minutes:
- Rating (1–5):
- Output → project: used as the visual spec for the code stage. Two decisions made at handoff: build the 3 core screens plus one results graph (gauge) only; keep the Figma logo even though the handoff says text-only header.
- Friction: the handoff and the Figma redesign disagreed on font and logo, which needed an explicit decision.

## 2026-10-24 — Code generation: implemented the Claude Design screens
- Tool: Claude Code, reading the handoff source and porting it into the existing React pages and CSS tokens (no generated app; existing camera, rep-counting and API logic untouched).
- Minutes:
- Rating (1–5):
- Output → project: commits d5058c8 and 476228a. App-wide font switch; test-in-progress overlays, progress bar and side panel; results page with verdict, gauge, tiles; new history layout. Sample data replaced with real session data (previous test, CDC band and threshold, profile test interval). Type-check, 20 tests and lint pass.
- Friction: merge conflict on History — the backend partner shipped a trend chart (TrendSummary, /api/trends) to the same spot at the same time. Kept the partner's chart inside the new layout and dropped the design's bar chart; renamed a clashing `.legend` CSS class. Results and History not yet checked visually with real test data. Left out the header "Test in progress" badge (needs shared state) and the trend/pace/report variants.
