# WorkshopOS — Design System

The visual and interaction language for WorkshopOS. This is the design counterpart
to the technical [architecture](01-architecture.md): where that doc defines how the
system is built, this defines how it looks, feels, and behaves for the people using it
all day on the shop floor and in the office.

- **Implemented tokens & components:** [`packages/web/src/index.css`](../packages/web/src/index.css)
- **Living style guide (open in a browser):** [`design/styleguide.html`](design/styleguide.html)

---

## 1. Who we're designing for

| User | Context | Design implication |
|------|---------|--------------------|
| Owner / Accounts | Desk, long sessions, many numbers | Data density, tabular figures, trustworthy money, keyboard-fast forms |
| Store / Supervisor | Between desk and floor, sometimes a tablet | Larger targets, forgiving forms, clear status |
| Employee | Shared kiosk tablet at the entrance | One big action, minimal reading, high contrast |

WorkshopOS is a **tool, not a website**. It's opened first thing in the morning and
used until close. Every decision favors *clarity, speed, and low fatigue* over
decoration.

## 2. Design principles

1. **Legibility of money above all.** Amounts use tabular (monospaced) figures,
   right-aligned, with consistent decimals. Positive/negative are color-coded but never
   color-only. A number should never be ambiguous.
2. **Dense, but breathing.** ERPs are tables. We keep rows compact (40px) yet give
   cards and sections generous padding so the screen never feels cramped.
3. **Fast entry.** Forms are keyboard-first: logical tab order, inline validation,
   sensible defaults (today's date, the only location, the item's sale price).
4. **Status is always visible.** Draft / Posted / Paid / Overdue / Low-stock are shown
   as consistent badges so state is readable at a glance.
5. **Calm and low-fatigue.** A dark, industrial graphite theme by default; muted
   surfaces; one confident accent. Motion is minimal and never decorative.
6. **Trust through consistency.** The same action looks the same everywhere; posting a
   document always asks for confirmation and is irreversible afterward, and the UI says so.

## 3. Brand & tone

- **Personality:** industrial, precise, dependable — a well-organised workshop.
- **Mark:** a small graphite square with a blue→amber gradient (steel + safety), set
  beside the "WorkshopOS" wordmark in the sidebar.
- **Voice:** plain and direct. "Post invoice", "Mark paid", "Give advance". Errors say
  what happened and what to do. Never jargon where a plain word exists.

## 4. Color

Semantic tokens, not raw hex, are used everywhere (see `index.css`). Dark is the
product default; a print-friendly light theme ships under `[data-theme="light"]`.

### Neutrals (graphite scale)
Backgrounds and surfaces step from `--bg` (app) → `--surface` (cards, sidebar) →
`--surface-2` (inputs, hover) → `--surface-3`. Borders: `--border`, `--border-strong`.
Text: `--text` → `--text-muted` → `--text-faint`.

### Accent & semantic
| Token | Use | Dark value |
|-------|-----|-----------|
| `--primary` | Primary actions, active nav, links | `#3b82f6` |
| `--success` | Paid, positive money, confirmations | `#22c55e` |
| `--warning` | Draft, due-soon, attention | `#f59e0b` |
| `--danger` | Overdue, negative money, destructive | `#ef4444` |
| `--info` | Neutral information | `#38bdf8` |
| `--pos` / `--neg` | Money up / down | green / red |

Each semantic color has a `-weak` background variant for badges and alerts.
**Contrast:** body text targets WCAG AA (≥4.5:1); large text and UI ≥3:1. Color is
always paired with a label, icon, or shape — never the sole signal.

## 5. Typography

- **Sans** (`--font-sans`): system UI stack — fast, native, legible.
- **Mono** (`--font-mono`): all money and quantities, for tabular alignment.
- **Scale:** 12 / 13 / 14 (base) / 16 / 20 / 24 / 30. Weights 400/500/600/700.
- **Rules:** numbers use `font-variant-numeric: tabular-nums`; headings tighten
  letter-spacing slightly; line-height 1.5 for body, 1.25 for headings.

## 6. Spacing, radius, elevation

- **Spacing** on a 4px base: `--space-1..12` (4→48). Card padding 24; form field gap 12.
- **Radius:** `--radius-sm` 6 (inputs), `--radius-md` 8 (buttons), `--radius-lg` 12
  (cards), `--radius-pill` (badges).
- **Elevation:** `--shadow-1` for cards, `--shadow-2` for the printed document,
  `--shadow-pop` for modals/menus. Elevation is subtle — this is a workspace, not a
  showcase.

## 7. Layout

```
┌────────────┬─────────────────────────────────────────┐
│  Sidebar   │  Content (max 1200px)                    │
│  224px     │   ┌─ h2 page title                       │
│  · logo    │   ├─ action/form cards                   │
│  · nav     │   └─ data table / report                 │
│  · user    │                                          │
└────────────┴─────────────────────────────────────────┘
```

- **Shell:** fixed 224px sidebar + fluid content, capped at 1200px for readability.
- **Nav** is permission-filtered — users only see what they can use.
- **Responsive:** under 860px the sidebar becomes a horizontal top bar; the kiosk
  (attendance clock) is a single centered card with a large target.
- **Density:** tables are full-bleed within their card; forms use a 1–3 column `.row`.

## 8. Components

Each component and its states live in the [style guide](design/styleguide.html). Summary:

| Component | Variants / states |
|-----------|-------------------|
| **Button** | primary · secondary · danger; hover, focus-ring, disabled, loading |
| **Input / Select / Date** | default, focus (blue ring), error, disabled; label + help + error |
| **Card / Panel** | standard, `.narrow` (auth), stat tile |
| **Table** | sticky header, hover row, numeric right-align (mono), row actions |
| **Badge** | neutral · primary · success · warning · danger · info (status pills) |
| **Alert** | success · warning · danger · info (inline, left-accent) |
| **Nav item** | default, hover, active (accent bar + tint) |
| **Tabs** | used on Reports |
| **Document** | print-optimized invoice/payslip on white paper |

### Status → color mapping (canonical)
| Domain state | Badge |
|--------------|-------|
| Draft | `warning` |
| Posted / Approved | `primary` |
| Paid / Completed / Active | `success` |
| Partially paid | `info` |
| Overdue / Void / Cancelled / Low-stock | `danger` |
| Inactive / Closed | `neutral` |

## 9. Interaction patterns

- **List → detail:** every module opens on a filterable list; rows lead to detail.
- **Create form:** card with grouped fields, a single primary action, inline errors.
- **Post workflow:** documents are created as **Draft** (editable), then **Posted**
  (numbered, ledger-hit, immutable). Posting is a deliberate, confirmed action; the UI
  communicates irreversibility. Corrections are reversals (credit/debit notes), never edits.
- **Wizard:** first-run setup is a single sectioned card (Business → Fiscal year → Owner).
- **Dashboard:** a grid of stat tiles over lists/alerts (low stock, dues).
- **Report:** filter bar → table → CSV export; totals row emphasized.
- **Kiosk:** one screen, big "Clock in / out", employee identifies quickly.

## 10. Data & number formatting

- Money: grouped thousands, fixed decimals per currency, currency shown on totals;
  right-aligned, mono. Negative in `--neg`, gains in `--pos`.
- Dates: rendered in the business timezone; ISO in inputs, friendly in tables.
- Empty cells show `—`, never blank ambiguity.
- Every list has an explicit **empty state** ("No invoices yet.") and errors render as
  alerts, not silent failures.

## 11. Accessibility

- AA contrast; visible **focus rings** on every interactive element (`--focus-ring`).
- Full keyboard operability; logical tab order; labels tied to inputs.
- Targets ≥40px (≥44px in kiosk mode).
- Color never the only signal (badges carry text; money carries sign).
- `prefers-reduced-motion` disables transitions.
- `color-scheme` set so native controls (date pickers, scrollbars) match the theme.

## 12. Motion

Purposeful and quick: 120–200ms ease for hovers, focus, and theme changes. No
attention-grabbing animation in a tool people use for hours. All motion is gated behind
`prefers-reduced-motion`.

## 13. Theming & extension

- Tokens are CSS custom properties on `:root` (dark) and `[data-theme="light"]`.
  Re-theming = swapping token values; components never hardcode color.
- To add a component: compose from tokens, add it to the style guide, document its states.
- Legacy class names are preserved as aliases so the token system rolled in without a
  rewrite of existing screens.

## 14. Roadmap for the design system

- Extract tokens to a JSON source of truth and generate CSS + a Tailwind/`shadcn` theme
  (the app is on Tailwind-ready footing per the architecture).
- Add a real icon set (currently text-first); iconography for nav and actions.
- Toast notifications and a modal/confirm primitive (post/void confirmations).
- Loading **skeletons** for tables; density toggle (comfortable / compact).
- Figma library mirroring these tokens for design-time work (the repo is Figma-MCP ready).
