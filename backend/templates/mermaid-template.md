<!-- MERMAID TEMPLATE — locks syntax conventions only. Content is yours.

  LOCKED (always follow):
  - No inline style overrides — no `style`, no `classDef` color rules. The frontend
    applies theme colors (orange accent, dark/light bg) via CSS variables automatically.
    Adding colors here will conflict with the theme.
  - Node labels: plain text only, no HTML, max ~4 words. Long labels break layout.
  - Edge labels: concise — 1-4 words max using -->|label| syntax
  - Max ~10 nodes per diagram. More than that becomes unreadable in the panel.
  - Always use `graph` not `flowchart` — `flowchart` keyword has rendering issues.
  - Use `graph LR` for connections/wiring (things that flow left to right)
  - Use `graph TD` for sequences/steps (things that flow top to bottom)

  FREE (your judgment):
  - Content, node names, edge labels
  - Number of nodes (up to 10)
  - Which direction fits the diagram
  - Whether to use decision diamonds, rectangles, or circles

  NODE SHAPES — use these consistently:
  - [Text]    rectangle    — components, terminals, connectors
  - ((Text))  circle       — endpoints, sockets, ports
  - {Text}    diamond      — decisions, conditions
  - (Text)    rounded rect — actions, steps

  WHEN TO USE MERMAID (not a decision tree, not a calculator):
  - Physical connections: "which cable goes where", polarity setup, terminal wiring
  - Setup sequences: ordered steps where seeing the flow matters
  - Process relationships: how A leads to B leads to C
  NOT for: troubleshooting (use decision tree), settings/numbers (use calculator)
-->

EXAMPLE 1 — Polarity wiring diagram (use graph LR for wiring):

graph LR
  GC[Ground Clamp] -->|plugs into| POS((+ Terminal))
  TT[TIG Torch] -->|plugs into| NEG((- Terminal))
  POS --- M{OmniPro 220}
  NEG --- M
  M -->|DCEN setup| WP[Workpiece]

EXAMPLE 2 — Setup sequence (use graph TD for steps):

graph TD
  A[Install Wire Spool] --> B[Thread Wire Through Liner]
  B --> C[Set Drive Roll Groove]
  C -->|solid wire| D[V-groove side]
  C -->|flux-cored| E[Knurled side]
  D --> F[Set Tension 3-5]
  E --> G[Set Tension 2-3]
  F --> H[Test Feed]
  G --> H
