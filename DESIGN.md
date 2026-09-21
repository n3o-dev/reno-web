# Design tokens

Source: **Space Grotesk & DM Sans brand kit** (`space-grotesk-dm-sans-brand-kit.pdf`, fontpair.co).
Type, the four brand colours and the icon set come from that kit unchanged. Everything the kit
does not specify — a page plane, muted inks, and the data-viz ramps — is derived here and
recorded with its reasoning. Data-viz slots are validated with the `dataviz` skill's
`validate_palette.js`; re-run it if any value changes.

## Type

**Space Grotesk** for headings, **DM Sans** for everything else. Both from Google Fonts.
Stacks: `"Space Grotesk", system-ui, sans-serif` · `"DM Sans", system-ui, sans-serif`.

The kit's scale is built for marketing pages, where the body step is 20px. A dense dashboard
cannot use that for table cells, so the register below uses the scale's lower steps and adds
two, both marked. Nothing else is altered.

| Role | Step | Family | Size / line / tracking |
|---|---|---|---|
| Hero stat | H2 | Space Grotesk | 38 / 1.15 / -0.02em |
| Page title | H3 | Space Grotesk | 28 / 1.2 / -0.01em |
| Stat value | *added* | Space Grotesk | 32 / 1.05 / -0.02em |
| Section title | *added* | Space Grotesk | 17 / 1.3 / -0.005em |
| Body | Small | DM Sans | 16 / 1.55 / normal |
| Table cell | *added — dashboard density* | DM Sans | 14 / 1.5 / normal |
| Caption, meta, table header | Caption | DM Sans | 13 / 1.5 / 0.04em |
| Eyebrow | *added — matches the kit's own page eyebrows* | DM Sans | 11.5 / 1.2 / 0.10em, uppercase |

Display 72 and H1 52 are unused: no dashboard screen carries a marketing headline.
Body 20 is unused: there is no long-form copy.

## Colour

### From the kit
| Token | Hex | Kit role |
|---|---|---|
| `--surface` | `#FFFFFF` | Background / Surface |
| `--ink` | `#400000` | Text |
| `--primary` | `#DC5F05` | Primary |
| `--accent` | `#820000` | Accent |
| `--line` | `#E4DBDB` | Border |

### Derived, with reasoning
| Token | Hex | Why |
|---|---|---|
| `--plane` | `#f8f4f4` | The kit sets Background and Surface both to `#FFFFFF`, so cards would not separate from the page. A warm tint one step off white, keyed to the border hue. 1.09:1 against a card — present, never loud. |
| `--muted` | `#7a5c5c` | Secondary ink. 5.98:1 on white, clears AA for body. |
| `--faint` | `#947878` | Axis labels and tertiary meta. 4.03:1 — AA for large and UI text; never carries a value on its own. |
| `--tint` | `#fdf0e6` | Selected rows and soft highlight. The lightest step of the sequential ramp, so highlights stay in the brand hue. |

### Two contrast rules that come from the kit's own check page

1. **Text on a primary surface is `#400000`, never white.** White on `#DC5F05` is 3.70:1; `#400000` on `#DC5F05` is 4.67:1. The kit's own sample card does the same.
2. **`#DC5F05` is never small text on white.** 3.70:1 is large-text-only. Where an accent must read as text, use `--accent` `#820000` (10.77:1). The eyebrow is therefore `#820000`, not orange.

Dark surfaces use `--ink` `#400000` with white text (17.24:1).

### Data — ordinal (shifts, funnel stages)
`#f2a065` → `#dc5f05` → `#8a3c03`. Brand primary is the middle step.
Shifts are ordered — morning, afternoon, night — so they take a ramp, not a categorical set.
Darkest is shift 1, the largest; lightest is shift 3, the smallest.

> Validated `--ordinal --mode light --surface #ffffff`: monotone PASS, adjacent ΔL PASS,
> light-end contrast 2.10:1 PASS, single hue (9° spread) PASS.

### Data — sequential (heatmaps)
`#fdf0e6` `#fbdcc4` `#f8c49c` `#f4a870` `#ee8a42` `#dc5f05` `#b94e04` `#8a3c03` `#5c2802`

> Verified: lightness monotone light→dark PASS, hue spread 14° PASS (single hue).
> The lightest step is allowed to recede toward the surface — that is what "near zero" means
> on a sequential scale.

### Data — categorical (unordered: complaint causes, report defects)
`#dc5f05` `#2a78d6` `#1baf7a` `#7f66ff` `#e87ba4` — fixed order, never cycled. A sixth
category folds into "Other".

> Validated `--mode light --surface #ffffff`: lightness band PASS, chroma floor PASS,
> CVD separation 18.1 PASS, normal-vision floor 24.0 PASS.
> Contrast WARN on `#1baf7a` and `#e87ba4` — **relief is mandatory**: these series always ship
> visible direct labels and a table view.

**Why this leaves the brand hue.** The kit is warm monochrome — orange, dark red, maroon all
sit within about 30° of hue. Unordered categories need separable hues, and any set drawn only
from the kit fails CVD separation outright. Brand orange therefore leads as slot 1 and the
remaining slots are chosen to pass the gate. This is the documented onboarding method: keep the
brand's hue where it can lead, snap the rest to passing steps. Ordinal, sequential and all
chrome stay fully on-brand; only unordered categorical work leaves it.

### Data — status (fixed, never themed)
| Role | Hex |
|---|---|
| good | `#0ca30c` |
| warning | `#fab219` |
| serious | `#ec835a` |
| critical | `#d03b3b` |

**Collision warning.** With a warm brand these sit close to brand colours — `#ec835a` against
primary `#DC5F05`, `#d03b3b` against accent `#820000`. Status therefore **never travels as
colour alone**: every status carries a Feather icon and a text label, and status colour is
never used for a data series.

## Icons

**Feather, 2px stroke**, from the kit. Status mapping:
good → `check-circle` · warning → `alert-triangle` · critical → `alert-octagon` ·
blocked → `pause-circle` · human input → `edit-2` · external → `external-link` ·
unknown → `help-circle` · neutral → `circle`.

## Spacing and shape

4px base: `4 8 12 16 20 24 32 40 48 64`. Card padding 20px, grid gutter 16px, table cell 10px.

| Token | Value |
|---|---|
| Radius, card | 14px |
| Radius, control | 9px |
| Radius, pill | 999px |
| Radius, bar end | 4px |
| Hairline | 1px `--line` |
| Card elevation | none — hairline only |

## Chart rules carried from `dataviz`

Categorical hues in fixed order, never cycled · never a dual-axis chart · 2px surface-coloured
gap between stacked segments and adjacent bars · 4px rounded data-end, flat at the baseline ·
legend for two or more series, direct labels at four or fewer · hover tooltip on every mark ·
table view on every chart · text wears ink tokens, never the series colour.

## Not covered yet

**Dark mode.** Light only. Dark steps must be selected from these ramps and validated against a
dark surface, not produced by inverting these values.
