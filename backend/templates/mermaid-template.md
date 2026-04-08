<!-- MERMAID TEMPLATE — locks syntax and style conventions. Content is yours.

  LOCKED (always follow):
  - No inline style overrides — no `style`, no `classDef` color rules
    The frontend applies theme colors (orange accent, dark/light bg) via CSS variables automatically.
    Adding colors here will conflict with the theme.
  - Always use `graph` not `flowchart` — `flowchart` keyword has rendering issues
  - Use `graph LR` for wiring/connections (things that flow left to right)
  - Use `graph TD` for sequences/decisions (things that flow top to bottom)
  - Node labels: plain text only, no HTML, max ~5 words
  - Edge labels: 1–4 words max using -->|label| syntax
  - Max ~12 nodes per diagram. More becomes unreadable.
  - Quote edge labels that contain spaces or special chars: -->|"+ socket"| not -->|+ socket|

  NODE SHAPES — use these consistently, they carry meaning:
  - [Text]    rectangle    — physical components, terminals, manuals, outputs
  - ((Text))  circle       — sockets, ports, connection points, endpoints
  - {Text}    diamond      — decisions, conditions, branch points
  - (Text)    rounded rect — steps, actions, procedures
  - >Text]    flag/arrow   — warnings, cautions, important notes

  WHEN TO USE MERMAID:
  - Wiring: which cable plugs into which socket, DCEN/DCEP polarity setup
  - Process selection: what process/settings to use based on material/thickness
  - Setup sequences: ordered steps where branching matters
  - Component relationships: how parts connect physically
  NOT for: troubleshooting trees with 3+ branches (use HTML decision tree instead)
  NOT for: tables of numbers (use HTML calculator instead)
-->

EXAMPLE 1 — Polarity wiring (DCEN for flux-cored, graph LR):

graph LR
  GC[Ground Clamp] -->|"+ socket"| POS(("⊕ Positive"))
  TT[Work Cable] -->|"- socket"| NEG(("⊖ Negative"))
  POS --- M[OmniPro 220]
  NEG --- M
  M -->|DCEN| WP[Workpiece]
  TH[FCAW Torch] -->|"- socket"| NEG

EXAMPLE 2 — Process selection by material (graph TD):

graph TD
  A{Material type?} -->|Steel / Iron| B{Thickness?}
  A -->|Aluminum| C[TIG — DCEP]
  A -->|Thin sheet| D[MIG 120V]
  B -->|"< 3/16 inch"| E[MIG 120V or 240V]
  B -->|"> 3/16 inch"| F[MIG 240V or Stick]
  E --> G(Set voltage + wire speed)
  F --> H(Set higher amperage)

EXAMPLE 3 — Setup sequence with branch (graph TD):

graph TD
  A(Select wire type) --> B{Solid or flux-cored?}
  B -->|Solid wire| C(V-groove drive roll)
  B -->|Flux-cored| D(Knurled drive roll)
  C --> E(Set gas — 75/25 Argon/CO2)
  D --> F(No gas needed — self-shielded)
  E --> G(Set polarity DCEP)
  F --> H(Set polarity DCEN)
  G --> I[Ready to weld]
  H --> I
