# Design tokens

Source: **Space Grotesk & DM Sans brand kit** (`space-grotesk-dm-sans-brand-kit_1.pdf`,
fontpair.co). Type, the four brand colours, the border and the icon set come from that kit
unchanged. Everything the kit does not specify — a page plane, muted inks, and the data-viz
ramps — is derived here and recorded with its reasoning. Data-viz slots are validated with the
`dataviz` skill's `validate_palette.js`; re-run it if any value changes.

## Type

**Space Grotesk** for headings, **DM Sans** for everything else. Both from Google Fonts.
Stacks: `"Space Grotesk", system-ui, sans-serif` · `"DM Sans", system-ui, sans-serif`.

The kit's scale is built for marketing pages, where the body step is 20px. A dense dashboard
cannot use that for table cells, so the register below uses the scale's lower steps and adds
three, each marked. Nothing else is altered.

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

This kit is **warm neutral** — espresso, cream, brown, white. There is no saturated hue in it
at all. That single fact drives every decision below.

### From the kit
| Token | Hex | Kit role |
|---|---|---|
| `--surface` | `#FFFFFF` | Background / Surface |
| `--ink` | `#1D1409` | Text |
| `--cream` | `#F4E3D0` | Primary |
| `--accent` | `#4B3D2E` | Accent |
| `--line` | `#DFDEDD` | Border |

**`--cream` is a surface, not an accent.** The kit's own contrast page puts `#F4E3D0` at
1.25:1 on white. It can never be a chart mark, a rule, an icon or text. It is a fill you put
things *on*: highlight rows, the hero tile, the active toggle. Named `--cream` rather than
`--primary` so nothing reaches for it as an accent by reflex.

### Derived, with reasoning
| Token | Hex | Why |
|---|---|---|
| `--plane` | `#f7f5f2` | The kit sets Background and Surface both to `#FFFFFF`, so cards would not separate from the page. A warm off-white; 1.09:1 against a card — present, never loud. |
| `--muted` | `#6f6558` | Secondary ink. 5.71:1 on white, clears AA for body. |
| `--faint` | `#8d8377` | Axis labels and tertiary meta. 3.72:1 — AA for large and UI text; never carries a value alone. |

### Contrast rules taken from the kit's own check page
| Pairing | Ratio | Use |
|---|---|---|
| `#1D1409` on white | 18.16 | Body text |
| `#4B3D2E` on white | 10.47 | Eyebrow, accent text, single-series marks |
| white on `#1D1409` | 18.16 | Dark surfaces — the header |
| `#1D1409` on `#F4E3D0` | 14.48 | The hero tile and the active toggle |
| `#F4E3D0` on white | **1.25** | Surface only. Never a mark, never text. |

### Data — ordinal (shifts, funnel stages)
`#c4b39c` → `#8a7354` → `#4b3d2e`. The dark step **is** brand accent `#4B3D2E`.
Shifts are ordered — morning, afternoon, night — so they take a ramp, not a categorical set.
Darkest is shift 1, the largest; lightest is shift 3, the smallest.

> Validated `--ordinal --mode light --surface #ffffff`: monotone PASS, adjacent ΔL PASS,
> light-end contrast 2.04:1 PASS, single hue (7° spread) PASS.

Single-series bars use the mid step `#8a7354` — dark enough to read, distinct from body text.

### Data — sequential (heatmaps)
`#faf5ef` `#f4e3d0` `#e7d2b8` `#d7bd9c` `#c4a67f` `#ac8b62` `#8f7049` `#6b5436` `#4b3d2e`

> Verified: lightness monotone light→dark PASS, hue spread 5° PASS (single hue).
> Brand cream is step 2 and brand accent is step 9, so the whole ramp is on-brand.

### Data — categorical (unordered: complaint causes, report defects)
`#2a78d6` `#eb6834` `#1baf7a` `#eda100` `#e87ba4` — fixed order, never cycled. A sixth
category folds into "Other".

> Validated `--mode light --surface #ffffff`: lightness band PASS, chroma floor PASS,
> CVD separation 9.1 PASS, normal-vision floor 19.6 PASS.
> Contrast WARN on `#1baf7a`, `#eda100`, `#e87ba4` — **relief is mandatory**: these series
> always ship visible direct labels and a table view.

**Why none of this is brand colour.** A categorical slot must carry chroma ≥ 0.1 or it reads
as grey and stops separating anything. Measured, the four brand colours come in at 0.031,
0.053, 0.037 and 0.031 — all grey by that test — and the brand's two closest steps also fail
the normal-vision floor at ΔE 15.0. So unlike a branded-hue kit, this one has nothing that can
lead the set, and the reference theme is used in its own documented order. This affects exactly
two charts: complaint Cause and report Defects. Ordinal, sequential, status and every piece of
chrome stay fully on-brand.

### Data — status (fixed, never themed)
| Role | Hex |
|---|---|
| good | `#0ca30c` |
| warning | `#fab219` |
| serious | `#ec835a` |
| critical | `#d03b3b` |

Against a neutral brand these read cleanly with no collision — the hazard the previous warm
kit created is gone. Status still never travels as colour alone: every status carries a Feather
icon and a text label, and status colour is never used for a data series.

## Icons

**Feather, 2px stroke**, from the kit. Status mapping:
good → `check-circle` · warning → `alert-triangle` · critical → `alert-octagon` ·
blocked → `pause-circle` · human input → `edit-2` · external → `external-link` ·
unknown → `help-circle` · neutral → `circle` · chart explainer → `info`.

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

Every chart also carries an `info` control: what it shows, how the number is computed, and the
SOP rule or source behind it — behind a click, never printed on the page.

## Not covered yet

**Dark mode.** Light only. Dark steps must be selected from these ramps and validated against a
dark surface, not produced by inverting these values.
