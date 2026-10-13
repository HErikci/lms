---
name: LMS Academic EdTech
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44464f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747780'
  outline-variant: '#c4c6d0'
  surface-tint: '#465d91'
  primary: '#00163d'
  on-primary: '#ffffff'
  primary-container: '#0f2b5c'
  on-primary-container: '#7c94cb'
  inverse-primary: '#afc6ff'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#001c22'
  on-tertiary: '#ffffff'
  tertiary-container: '#00323c'
  on-tertiary-container: '#00a2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#afc6ff'
  on-primary-fixed: '#001944'
  on-primary-fixed-variant: '#2d4678'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  canvas-bg: '#f8fafc'
  surface-card: '#ffffff'
  border-subtle: '#e2e8f0'
  text-main: '#0f172a'
  text-muted: '#64748b'
  brand-navy-deep: '#0a1d3f'
  electric-blue-hover: '#0369a1'
  cyan-accent: '#0891b2'
  state-success: '#059669'
  state-warning: '#d97706'
  state-error: '#dc2626'
  state-info: '#2563eb'
  ai-assistant-tint: '#f0fdfa'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system establishes a high-performance, accessible, and structured environment for modern enterprise and academic Learning Management Systems. Designed to support rigorous educational requirements, administrative oversight, and student engagement, the aesthetic merges modern SaaS precision with educational clarity.

### Personality & Emotional Resonance
The interface projects authority, trustworthiness, and cognitive calm. Interfaces avoid visual clutter to minimize cognitive fatigue during lengthy study sessions and high-stakes examinations. Clear contrast ratios, intentional negative space, and vibrant focal points instill confidence, clarity, and motivation in learners and instructors alike.

### Design Movement: Modern Corporate EdTech
The design language is rooted in crisp, corporate SaaS minimalism accented with subtle structural depth:
- **Clean Surfaces**: Uncluttered cool-white canvases (`#f8fafc`) paired with pure white cards (`#ffffff`) for elevated readability.
- **Architectural Hierarchy**: Information chunking following strict progressive disclosure, optimizing modules, assignments, and analytics dashboards.
- **Accented Focus**: Vibrant electric blues and teals derived directly from the brand mark guide visual flow and signal interactive states without overpowering learning materials.

## Colors

The color palette is built around the institutional navy, dynamic electric blue, and modern cyan hues established by the brand identity. Accessibility (WCAG 2.1 AA requirement `≥ 4.5:1`) is maintained across all text-to-background combinations.

### Palette Hierarchy & Intent
- **Primary Navy (`#0f2b5c`)**: Anchors global navigation, top headers, primary page titles, and core institutional authority markers.
- **Secondary Electric Blue (`#0284c7`)**: Directs interactive focus. Used for primary CTA buttons, active tab indicators, selected course navigation steps, and core links.
- **Tertiary Cyan (`#06b6d4` / `#0891b2`)**: Signals progress, completion metrics, interactive achievements, and active module states.
- **Neutral Charcoal & Slate (`#0f172a`, `#64748b`)**: Provides high-contrast body typography and descriptive metadata.

### System Surface Tokens
- **Canvas Base (`#f8fafc`)**: Provides an ultra-clean, glare-reducing cool background for all application views.
- **Surface Card (`#ffffff`)**: Pure white containers for lessons, dashboard cards, quiz questions, and sidebar navigation.
- **AI Context Surfaces (`#f0fdfa`)**: Distinct soft cyan tint reserved for AI Learning Assistant responses to fulfill transparent disclosure constraints (`FR-57`).

## Typography

The typography scale utilizes **Plus Jakarta Sans** for structural brand headlines, dashboard titles, and modal headers, pairing it with **Inter** for sustained reading comfort across curriculum text, exam stems, and forum discussions.

### Hierarchy & Editorial Rules
- **Display & Headline Roles**: Rendered in Plus Jakarta Sans with subtle negative letter-spacing for tight, confident headers.
- **Reading Body**: Inter at `16px` (`body-lg`) with an expansive line height of `26px` is standard for long-form lesson modules and lecture notes to avoid eye strain.
- **Technical & Code Modules**: Formatted using monospaced styling within discussion forums (`FR-84`) and technical assignment briefs.
- **Localization Resilience**: All font pairings fully support Turkish diacritics (`ç`, `ğ`, `ı`, `ö`, `ş`, `ü`, `İ`) without unexpected glyph shifting or baseline alignment bugs.

## Layout & Spacing

The layout is built around a standard 8pt grid with responsive fluid scaling starting from a minimum viewport of `320px` (`NFR-33`) up to 4K ultra-wide monitors.

### Layout Architecture
- **Desktop (≥ 1280px)**: A 12-column grid configuration with a persistent 260px collapsible sidebar navigation, `2rem` outer canvas padding, and `1.5rem` gutters.
- **Tablet (768px – 1279px)**: An 8-column layout. Sidebar transitions into an off-canvas drawer or compact 72px rail. Inner margins adapt to `1.5rem`.
- **Mobile (320px – 767px)**: A single-column (or 4-column) stacked flow. App header with hamburger access, bottom navigation bar for quick access, and `1rem` outer canvas margins.

### Component Spacing Rhythm
- **Micro Spacing (`space-xs` to `space-sm`)**: Used for button internal padding, status badge insets, icon-to-label gaps, and metadata rows.
- **Macro Spacing (`space-md` to `space-xl`)**: Applied to card body padding, module list spacing, and gap distances between separate widget panels.

## Elevation & Depth

To preserve an academic, distraction-free environment, the design system utilizes low-elevation surfaces supported by crisp borders rather than heavy, dramatic shadows.

### Elevation Levels
- **Level 0 (Flat / Canvas)**: `#f8fafc` background layer. Contains zero shadow and no borders.
- **Level 1 (Cards, Modules & Panels)**: `#ffffff` surface, bounded by a 1px solid border in `#e2e8f0`, complemented by an ultra-subtle ambient drop: `box-shadow: 0 1px 3px 0 rgba(15, 43, 92, 0.04), 0 1px 2px -1px rgba(15, 43, 92, 0.04)`.
- **Level 2 (Dropdowns, Popovers & Hover States)**: `box-shadow: 0 4px 6px -1px rgba(15, 43, 92, 0.07), 0 2px 4px -2px rgba(15, 43, 92, 0.05)`.
- **Level 3 (Modals, AI Assistant Drawers & Focus Overlays)**: `box-shadow: 0 20px 25px -5px rgba(15, 43, 92, 0.12), 0 8px 10px -6px rgba(15, 43, 92, 0.08)`. Accompanied by a semi-transparent slate backdrop: `rgba(15, 23, 42, 0.45)` with `backdrop-filter: blur(4px)`.

### Accessibility Focus Rings
In adherence to WCAG AA (`NFR-30`), all interactive surfaces receive a high-visibility, 2px focus ring with a 2px offset:
`outline: 2px solid #0284c7; outline-offset: 2px;`.

## Shapes

The design system incorporates geometric stability with softened corners (`Level 2: Rounded`). This aligns with contemporary SaaS interfaces and balances institutional authority with an approachable learning experience.

### Radius Mapping
- **Default Elements (`rounded` / 0.5rem - 8px)**: Standard inputs, buttons, checklist selectors, course module list items, and tabular cells.
- **Large Containers (`rounded-lg` / 1rem - 16px)**: Course cards, assessment question containers, interactive analytics cards, and video player shells.
- **Extra Large Containers (`rounded-xl` / 1.5rem - 24px)**: Modal sheets, slide-over panels, and achievement summary banners.
- **Full Radius (Pill / 9999px)**: Progress chips, user presence avatars, status badges, and tag selectors.

## Components

### Buttons & Interactive Controls
- **Primary Action**: Solid `#0284c7` fill, white `#ffffff` label (`label-lg`), 8px corner radius, padding `0.75rem 1.5rem`. Hover shifts to `#0369a1`.
- **Secondary Action**: Bordered 1px `#e2e8f0` on `#ffffff` background with navy `#0f2b5c` text. Hover shifts background to `#f1f5f9`.
- **Destructive Action**: Solid `#dc2626` or soft red `#fee2e2` with `#b91c1c` text for critical test submission or account actions.

### Cards & Learning Modules
- Built on `#ffffff` with a crisp 1px `#e2e8f0` outer border.
- Headers feature a bottom border separator with `title-md` styling.
- Course cards include a 16:9 thumbnail ratio, category badge, linear progress bar, and continuing lesson CTA button.

### Progress Bars & Radial Indicators
- Track: `#e2e8f0`, 8px height with 9999px border radius.
- Indicator: Gradient transition from `#0284c7` to `#06b6d4`.
- Accompanying numerical text formatted using `label-md` in deep navy `#0f2b5c`.

### Form Fields & Inputs
- Height: 44px (touch accessible). Border: 1px `#cbd5e1`. Background: `#ffffff`.
- Placeholder: `#94a3b8`. Focus state: Border transitions to `#0284c7` with a 2px outer glow (`rgba(2, 132, 199, 0.2)`).

### AI Assistant Module (`FR-57`, `FR-53`)
- Dedicated slide-over panel styled with `#f0fdfa` background tint and `#06b6d4` header indicator.
- Automatically disabled and visually suppressed during active exam mode (`FR-53`).
- Distinct visual badges labeling responses as "AI-Generated" to maintain transparent disclosure.

### Assessment & Quiz Interfaces (`FR-43`)
- Large radio choice cards with 12px internal padding and clear letter badges (A, B, C, D).
- Selected state triggers a 2px `#0284c7` outline and `#f0f9ff` surface wash.
- Timer component fixed at the top right in `#0f2b5c` pill container with countdown contrast.