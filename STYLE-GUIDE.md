# Style Guide, Slow Folk product UI

Use this when creating or editing pages so they stay in the family.

The product UI is the fourth surface of the Slow Folk design system, next to
the deck, the site and documents. The tokens come from `slowfolk/design-system`
(built from the Figma Slides deck); this app reads them through
`src/styles/globals.css`. When the design system changes, the `--sf-*` block
in that file is the one thing to diff.

> Bone ground, white cards with a hairline, ABC Camera Plain, brown ink, one
> highlight (Brand Red), no shadows. Tabular numbers everywhere counts appear.
> Animation stays a 200 ms fade with a small Y nudge.

---

## 1. The shell

Every page starts the same way.

```tsx
'use client'; // if interactive

export function SomePageClient() {
  return (
    <main className="min-h-screen">
      <div className="page-container">
        {/* header, see §2 */}
        {/* content, see §6 */}
      </div>
    </main>
  );
}
```

The page ground (Bone) is set once on `<body>` in `src/app/layout.tsx` as
`bg-ground`. Do not repeat it on pages.

**Container width.**

| Page type | Class |
|---|---|
| Default (reports, tracker, content) | `page-container` (`max-w-4xl`, 896 px) |
| Tool with wide canvas (Tile Planner) | `max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8` |

If you need more than 900 px because you are rendering a wide SVG, drawing, or
side by side panels, override `page-container` rather than fight it.

**Server vs client.** `page.tsx` stays a server component and exports
`metadata`. All interactivity goes in `*-client.tsx`. Do not mix.

```tsx
// page.tsx
import { ThisClient } from './this-client';
export const metadata = { title: 'Thing — Slow Folk' };
export default function Page() { return <ThisClient />; }
```

---

## 2. Page header

```tsx
<div className="mb-6">
  <div className="flex items-center gap-2 mb-1.5">
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-status-{tone} text-status-{tone}-foreground border border-status-{tone}-border tracking-wide uppercase">
      Section
    </span>
  </div>
  <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
  <p className="text-sm text-muted-foreground mt-0.5">One line subtitle</p>
</div>
```

**Pick the badge tone by domain.** Only two tones are domain tags; the other
three statuses (warning, error, success) are states and never sit in a header.

| Tone | Use for | Looks like |
|---|---|---|
| `info` | Finance and data: CapEx, OpEx, labour, reports | Blue/60 fill, Base/Black text, Blue border |
| `build` | Planning tools: tile planner, sauna materials | Mud fill, Base/Black text |

---

## 3. Colour system

All colours live in `src/styles/globals.css`. The chain is:

```
Figma variable  -->  --sf-* (palette block)  -->  semantic token  -->  Tailwind utility
Bone #eeede9         --sf-bone                    --ground             bg-ground
Base/40 #dddcdd      --sf-base-40                 --border, --gray-2   border-border, border-gray-2
```

Components use the utilities on the right. **Never hardcode hex, and never
reference `--sf-*` directly**; the palette block is not bridged into Tailwind
on purpose.

### Surfaces and text (semantic)

| Token | Value | Use |
|---|---|---|
| `bg-ground` | Bone | Page ground, set on `<body>` |
| `bg-card` / `bg-background` | White | Cards, pills, inputs, popovers, tooltips |
| `bg-gray-1` | Bone/60 | Inset: KPI panels, stat chips, number inputs, table head rows |
| `bg-muted` / `bg-secondary` | Base/20 | Tracks, segmented control backgrounds, skeletons, "soon" chips |
| `bg-accent` | Base/20 | Hover fill on a white surface: dashboard cards, ghost and outline buttons, menu items |
| `text-foreground` | Brown/85 | Body reading colour (4.93:1 on Bone, 5.77:1 on white) |
| `text-fg-4` | Base/Black | Titles and values, the strongest ink; `h1` to `h4` get it by default |
| `text-muted-foreground` | Brown/60 | Secondary text. Labels, captions and hints only: it measures 2.71:1 on Bone and 3.17:1 on white, so never a sentence someone must read |
| `text-label` | Brown/80 | Eyebrows and labels inside a Bone/60 inset (7.85:1) |
| `border-border` / `border-gray-2` | Base/40 | The hairline. Every card, pill and input carries one |
| `bg-primary` / `text-primary` | Brown/80 | Solid buttons, active pills, the tab underline. `text-primary-foreground` is Bone on it |
| `bg-highlight` / `text-highlight` | Brand Red | The single highlight per view (a critical bar, one number) |
| `text-destructive` | Brand Red | Delete icons, error text |
| `ring-ring` | Red Dust | Focus ring |

### Status set

Every status is a trio used together:

```
bg-status-{x}   text-status-{x}-foreground   border border-status-{x}-border
```

| Status | Fill | Text | Use | Rule |
|---|---|---|---|---|
| `info` | Blue/60 | Base/Black | Domain badges, quoted items, hints, selected rows | |
| `build` | Mud | Base/Black | Planning tool badges | |
| `warning` | Brand Orange at 16 % | Red Dust | Demo data banner, invoiced items, calibration prompts | Always with an icon or a word |
| `error` | Brand Red at 9 % | Brand Red | Failed loads, over budget, danger signals | |
| `success` | Brand Mustard | Base/Black | Paid, on track, scale set | Always with an icon or a word |

Warning and error fills mix with `transparent`, so a banner on Bone takes the
ground and a banner on a white card takes the card.

**Value tones without a fill.** When only a number carries status: good is
`text-fg-4` (a good number needs no colour), attention is
`text-status-warning-foreground`, danger is `text-status-error-foreground`.
Bar fills follow the same order: `bg-primary`, `bg-status-warning-foreground`,
`bg-highlight`.

### Chart series (exception)

Chart series colours are the one place outside the brand palette: `--sky-1`
to `--sky-4`, `--green-4`, `--amber-4`, `--red-4`, `--purple-4` and the
charcoal `--chart-fill`. They are CSS variables only, not Tailwind classes;
use them in `style` props or SVG attributes. See §9.

---

## 4. Typography

ABC Camera Plain is the only face. One variable file
(`public/fonts/ABCCameraSuperfamilyVariable.woff2`) carries the weights; the
base layer selects the Plain cut on the file's `BULL` axis.

- Weights the brand uses: 400 (body copy), 500 (headings, UI, labels),
  700 (CAPS). There is no 600: `font-semibold` renders 500 and
  `font-extrabold` renders 700 (see `src/styles/theme.css`).
- No fallback family and `font-synthesis: none`. If the file is missing, the
  browser default shows; that is meant to be noticed.
- The current file is a 95 glyph subset (ASCII). Accents, curly quotes,
  dashes, the middle dot, arrows and currency signs other than `$` render in
  the browser default face until the full licensed file replaces it.
- `font-mono` is the same file on its `MONO` axis (ABC Camera Plain Mono).
  The Figma deck has no mono style; this is an addition.

| Role | Class |
|---|---|
| Page title | `text-2xl font-bold tracking-tight` |
| Section title (card header) | `text-sm font-semibold` |
| Section subtitle | `text-xs text-muted-foreground` |
| Stat value (big) | `text-lg font-semibold tabular-nums` |
| Stat value (small) | `text-sm font-semibold tabular-nums` |
| Eyebrow on white | `text-[10px] uppercase tracking-wide text-muted-foreground` |
| Eyebrow in an inset | `text-[10px] uppercase tracking-wide text-label` |
| Helper text | `text-[11px] text-muted-foreground` |
| Body | default 14 px (`text-sm`) for UI; 16 px for prose |
| Code / mono | `font-mono` on a chip: `bg-card/60 px-1 rounded` inside a banner, `bg-gray-1 px-1 rounded` on white |

Tracking: `tracking-tight` is -0.01 em (titles), `tracking-wide` and
`tracking-wider` are +0.02 em (eyebrows), matching the brand CAPS style.

**Always use `tabular-nums` for numbers in cards, tables, and stat blocks.**
Otherwise digits jitter on update.

---

## 5. Shape, spacing, borders

### Radii

The brand has two radii, 6 px (cards, tables) and 4 px (chips, inputs,
images), plus full pills. The Tailwind names are remapped, so existing class
sites keep working:

| Class | Renders | Use |
|---|---|---|
| `rounded-2xl`, `rounded-xl`, `rounded-lg` | 6 px | Cards, panels, banners, KPI insets |
| `rounded-md`, `rounded-sm`, `rounded` | 4 px | Inputs, chips, small buttons |
| `rounded-full` | pill | Badges, segmented controls, toggles, primary button |
| Decorative SVG | `rx={4}` to `rx={6}` | Skimmer and fitting overlays |

### Borders, no shadows

- Default card: `bg-card rounded-2xl border border-gray-2`
- Hover: `hover:bg-accent transition-colors`
- Soft inset (KPI block): `bg-gray-1 rounded-lg px-3 py-2`, no border
- Banner: `bg-status-{tone} border border-status-{tone}-border rounded-xl px-4 py-3`
- Overlays (dialog, sheet, popover) separate with their hairline; the scrim is `bg-overlay`

Every `shadow-*` token in `theme.css` is a transparent zero shadow, so an old
`shadow-1` renders nothing. Do not add new shadow classes; delete them when
you touch a line. The repo's interface skill (`.agents/skills/make-interfaces-feel-better`)
says "shadows over borders"; the brand rule wins here.

### Spacing scale

| Where | Gap / padding |
|---|---|
| Stacked sections inside main column | `space-y-6` |
| Grid of cards | `gap-3` (tight) to `gap-4` (relaxed) |
| Inside a card | `p-4` (most) or `p-5` (hero summary) |
| Header to content | `mb-6` after the page header, `mb-4` for sub sections |
| Within a stat chip | `px-3 py-2` (KPI) or `px-2.5 py-1.5` (compact) |
| Between header and content inside a card | `border-b border-gray-2` + `px-4 py-3` for the header row |

---

## 6. Component recipes

### Card

```tsx
<div className="bg-card rounded-2xl border border-gray-2">
  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-2">
    <div>
      <p className="text-sm font-semibold">Section name</p>
      <p className="text-xs text-muted-foreground">One line description</p>
    </div>
    {/* optional right side: toggle, action, legend */}
  </div>
  <div className="p-4">
    {/* content */}
  </div>
</div>
```

The `Card` primitive (`src/components/ui/card.tsx`) renders the same thing:
`bg-card border border-border sm:rounded-2xl`.

### KPI block

```tsx
<div className="bg-gray-1 rounded-lg px-3 py-2">
  <div className="text-[10px] uppercase tracking-wide text-label">Label</div>
  <div className="text-lg font-semibold tabular-nums leading-tight text-fg-4">42</div>
  <div className="text-[10px] text-muted-foreground mt-0.5">optional hint</div>
</div>
```

Tone the value with `text-status-warning-foreground` or
`text-status-error-foreground` when the number itself carries status. A good
number stays `text-fg-4`.

### Stat compact (inside elevation / dense layout)

```tsx
<div className="bg-gray-1 rounded-lg px-2.5 py-1.5">
  <div className="text-[10px] uppercase tracking-wide text-label">Label</div>
  <div className="text-sm font-semibold tabular-nums text-fg-4">value</div>
  <div className="text-[10px] text-muted-foreground mt-0.5">hint</div>
</div>
```

### Banner (warning / demo / info)

```tsx
<div className="bg-status-warning border border-status-warning-border rounded-xl px-4 py-3 text-sm text-status-warning-foreground mb-4">
  <span className="font-semibold">Demo data</span> — explanation, with
  <code className="font-mono bg-card/60 px-1 rounded">tokens</code> in mono chips.
</div>
```

Swap `warning` for `info`, `error` or `success`. Success and warning banners
need an icon or a word that says what they are; colour never carries the
meaning alone.

### Segmented control / pill toggle

```tsx
<div className="flex items-center gap-1 text-xs bg-muted rounded-full p-0.5">
  <button
    onClick={() => setMode('a')}
    className={`px-3 py-1 rounded-full transition-colors ${
      mode === 'a' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground'
    }`}
  >
    Option A
  </button>
  {/* … */}
</div>
```

The active pill is Brown/80 with Bone text everywhere (tile controls, report
granularity, demand panel, PDF viewer). Do not use a white active pill; on a
Base/20 track it has no contrast without a shadow.

### Tab nav (under page header)

See `src/components/tracker/TrackerNav.tsx`. Active tab gets
`text-primary border-b-2 border-primary -mb-px`; inactive is
`text-muted-foreground hover:text-fg-4`. A "soon" tab is `disabled` with a
small `bg-muted` chip.

### CTA card (link in a grid)

```tsx
<Link href="/somewhere" className="block mb-6">
  <Card className="bg-status-info border-status-info-border rounded-2xl hover:bg-accent transition-colors">
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-status-info-foreground">Title</p>
        <p className="text-sm text-muted-foreground mt-0.5">One liner</p>
      </div>
      <span className="text-status-info-foreground text-lg">→</span>
    </CardContent>
  </Card>
</Link>
```

### Form: number input row

```tsx
<label className="flex items-center justify-between gap-2 text-sm">
  <span className="text-muted-foreground flex-1 truncate">Label</span>
  <input
    type="number"
    value={value}
    step={1}
    onChange={…}
    className="w-20 h-7 px-2 text-right text-sm tabular-nums bg-gray-1 border border-gray-2 rounded focus:outline-none focus:border-primary"
  />
</label>
```

### Form: slider

```tsx
<input
  type="range"
  …
  className="w-full accent-primary"
/>
```

`accent-primary` is the standard way to colour native form controls; use it
for sliders, checkboxes, radios.

### Form: toggle switch

```tsx
<button
  type="button"
  onClick={() => onChange(!checked)}
  className={`relative w-9 h-5 rounded-full transition-colors ${
    checked ? 'bg-primary' : 'bg-input'
  }`}
>
  <span
    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full transition-transform ${
      checked ? 'translate-x-4' : ''
    }`}
  />
</button>
```

Off is the hairline colour (Base/40), on is Brown/80, the thumb is white.

---

## 7. Animation

One animation utility, one rhythm.

```tsx
<div className="section-animate" style={{ animationDelay: '0ms' }}>…</div>
<div className="section-animate" style={{ animationDelay: '60ms' }}>…</div>
<div className="section-animate" style={{ animationDelay: '120ms' }}>…</div>
```

- **`section-animate`** is a 200 ms fade in plus a small Y translate on entry (defined in `globals.css`).
- Stagger sequential sections by **60 ms**: 0, 60, 120, 180, 240, …
- Do not add bespoke motion. If you need more, extend the existing class.
- For micro interactions, `transition-colors` is enough. There are no shadows to transition. Avoid `transition-all`.

---

## 8. Loading / error / empty states

Keep these three components consistent across pages; copy from
`src/app/tracker/tracker-client.tsx`.

```tsx
function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-2xl" />
        ))}
      </div>
      <div className="h-48 bg-muted rounded-2xl" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-status-error border border-status-error-border rounded-xl px-4 py-4 text-sm text-status-error-foreground">
      <p className="font-semibold">Failed to load</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
    </div>
  );
}
```

Empty states use the same banner shape with `bg-gray-1 border border-border`
and `text-muted-foreground`.

---

## 9. Data visualisation

### Charts (Recharts)

Chart chrome follows the brand through the chart tokens in `globals.css`:

| Part | Value |
|---|---|
| Grid lines | `stroke="var(--chart-grid)"` (Base/40) |
| Axis ticks and legend text | `fill: 'var(--chart-label)'`, `color: 'var(--chart-label)'` (Brown/60), 11 to 12 px, never bold |
| Hover cursor (bar charts) | `cursor={{ fill: 'var(--chart-cursor)' }}` |
| Tooltip | `chartTooltipContentStyle` from `src/lib/chartTooltip.ts`, or a custom box `bg-card border border-border rounded-xl px-3 py-2 text-sm` |
| Crosshair, marker badges | `--chart-crosshair`, `--chart-marker-badge-background` (Brown/80) |

Series colours are the documented exception to the brand palette. They stay
as they are, and they are CSS variables only:

| Series | Variable |
|---|---|
| Budget pace, primary line | `--sky-3`, `--sky-4`, area fill `--sky-1` |
| Actual, "under" | `--green-4` |
| Forecast, "attention" | `--amber-4` |
| Over, negative | `--red-4` |
| Fifth series | `--purple-4` |
| Neutral bars, dots, heat cells | `--chart-fill` (charcoal), often through `color-mix` |

Because they are not Tailwind classes, legend swatches and signed values use
`style={{ background: 'var(--sky-3)' }}` or `style={{ color: … }}`, not
`bg-sky-3`. Text next to a mark wears text tokens, not the series colour.

### Schematic SVG (Tile Planner pattern)

When drawing physical things in mm:

- Set `viewBox` in real world mm; never in px.
- `preserveAspectRatio="xMidYMid meet"`.
- Add an `aspect-ratio` style on the `<svg>` so the container reserves the right vertical space before scripts run.
- Wrap the tile / pattern grid in a `<clipPath>` so cut elements do not bleed outside the body.
- Colour palette inside an SVG (kept as drawn; a second documented exception):
  - Hot zones: `#ff7a3a` stroke, `rgba(255,122,58,0.18)` fill.
  - Cold zones: `#2c78fc` stroke, `rgba(44,120,252,0.18)` fill.
  - Cut / loss: `rgba(255,47,0,0.7)` stroke, `rgba(255,47,0,0.18)` fill.
  - Skimmer / utility: `#ffa600` stroke, `#fff8eb` fill.
  - Fitting / part: `#1f8a3f` stroke, `rgba(51,199,88,0.4)` fill.

---

## 10. Naming, files, and conventions

| Item | Convention | Example |
|---|---|---|
| Page route | lowercase, single word | `src/app/tiles/page.tsx` |
| Client component | `*-client.tsx`, kebab | `tiles-client.tsx` |
| Feature components | PascalCase folder | `src/components/tiles/PlanView.tsx` |
| Domain logic | camelCase in `src/lib/` | `tilePlanner.ts` |
| Domain types | PascalCase in `src/types/` | `tiles.ts` exports `TilePlanConfig`, `TileCell` |
| Hooks | `use{Thing}` | `useCapExData` |
| Shadcn primitives | `src/components/ui/`, regenerate via CLI | see the brand edits below |

Import alias is `@/*` for `src/*`.

**Brand edits inside `src/components/ui/`.** The primitives take the brand
from the tokens, except these four edits. Re-apply them after any
regeneration:

| File | Edit |
|---|---|
| `card.tsx` | `bg-card border border-border sm:rounded-2xl` (hairline, no shadow) |
| `tabs.tsx` | active trigger `bg-primary text-primary-foreground` |
| `dialog.tsx`, `sheet.tsx`, `alert-dialog.tsx`, `drawer.tsx` | overlay `bg-overlay` instead of `bg-black/80` |
| `toast.tsx` | destructive close button uses `destructive-foreground` and `destructive` instead of Tailwind `red-*` |

`components.json` has an empty `tailwind.config` on purpose: the project is
Tailwind v4, configured in CSS.

---

## 11. Page skeleton (copy and paste)

A new page starts from this template; replace the badge tone, title, and
content.

```tsx
'use client';

import { useState } from 'react';

export function NewThingClient() {
  return (
    <main className="min-h-screen">
      <div className="page-container">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-status-info text-status-info-foreground border border-status-info-border tracking-wide uppercase">
              Section
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">New Thing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            One line subtitle that says what this is for
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <div className="section-animate" style={{ animationDelay: '0ms' }}>
            <div className="bg-card rounded-2xl border border-gray-2">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-2">
                <div>
                  <p className="text-sm font-semibold">Card title</p>
                  <p className="text-xs text-muted-foreground">Caption</p>
                </div>
              </div>
              <div className="p-4">
                {/* content */}
              </div>
            </div>
          </div>

          <div className="section-animate" style={{ animationDelay: '60ms' }}>
            {/* next section */}
          </div>
        </div>
      </div>
    </main>
  );
}
```

---

## 12. Quick checklist before shipping a page

- [ ] Uses `page-container` (or a justified override), not raw widths
- [ ] Header has an `info` or `build` badge, `text-2xl` title, and muted subtitle
- [ ] Sections are wrapped in `section-animate` with 60 ms staggered delays
- [ ] Cards use `bg-card rounded-2xl border border-gray-2`; no `shadow-*` classes
- [ ] Status is shown with `status-*` trios, never a Tailwind default colour (`amber-50`, `green-600`, `violet-*`)
- [ ] Success and warning states carry an icon or a word
- [ ] `text-muted-foreground` is on labels and captions only, never on a sentence
- [ ] Numbers carry `tabular-nums`
- [ ] No hex colours in components, only tokens (chart series and schematic SVGs excepted)
- [ ] No `text-white` or `bg-white`; use `text-primary-foreground` and `bg-card`
- [ ] Loading and error states exist where data is fetched
- [ ] Mobile breakpoint (`sm:`) handled for any grid (`grid-cols-1 sm:grid-cols-2 …`)
- [ ] Brand Red appears at most once or twice per view
- [ ] Server `page.tsx` exports `metadata` with the title pattern `… — Slow Folk`
