# Slop & Slide v2 — UI Style Guide

## Tech Stack
- **React + TypeScript + Vite**
- **Tailwind CSS v4** with CSS variable–based tokens
- **Base UI (`@base-ui/react`)** — unstyled headless components
- **CVA (class-variance-authority)** — component variant management
- **lucide-react** — icons
- **sonner** — toasts
- **clsx + tailwind-merge** — `cn()` utility

---

## 1. Color System (CSS Variables — OKLCH)

All colors use OKLCH color space for perceptual uniformity.

### Light Mode (`:root`)
```css
--background: oklch(1.0000 0 0);              /* Pure white */
--foreground: oklch(0.2101 0.0318 264.6645);  /* Dark blue-gray */
--card: oklch(1.0000 0 0);
--card-foreground: oklch(0.2101 0.0318 264.6645);
--popover: oklch(1.0000 0 0);
--popover-foreground: oklch(0.2101 0.0318 264.6645);
--primary: oklch(0.6716 0.1368 48.5130);      /* Golden-orange */
--primary-foreground: oklch(1.0000 0 0);
--secondary: oklch(0.5360 0.0398 196.0280);   /* Muted blue */
--secondary-foreground: oklch(1.0000 0 0);
--muted: oklch(0.9670 0.0029 264.5419);       /* Light gray */
--muted-foreground: oklch(0.5510 0.0234 264.3637);
--accent: oklch(0.9491 0 0);                  /* Off-white */
--accent-foreground: oklch(0.2101 0.0318 264.6645);
--destructive: oklch(0.6368 0.2078 25.3313);  /* Red-orange */
--destructive-foreground: oklch(0.9851 0 0);
--border: oklch(0.9276 0.0058 264.5313);
--input: oklch(0.9276 0.0058 264.5313);
--ring: oklch(0.6716 0.1368 48.5130);         /* = primary */
--radius: 0.75rem;
--sidebar: oklch(0.9670 0.0029 264.5419);     /* Same as muted */
```

### Dark Mode (`.dark`)
```css
--background: oklch(0.1797 0.0043 308.1928);  /* Very dark blue */
--foreground: oklch(0.8109 0 0);              /* Bright cream */
--card: oklch(0.1822 0 0);
--primary: oklch(0.7214 0.1337 49.9802);      /* Brighter gold */
--secondary: oklch(0.5940 0.0443 196.0233);
--muted: oklch(0.2520 0 0);
--muted-foreground: oklch(0.6268 0 0);
--accent: oklch(0.3211 0 0);
--border: oklch(0.2520 0 0);
--input: oklch(0.2520 0 0);
```

### Shadow Variables
```css
--shadow-sm: 0px 1px 4px 0px hsl(0 0% 0% / 0.05), 0px 1px 2px -1px hsl(0 0% 0% / 0.05);
--shadow-md: 0px 1px 4px 0px hsl(0 0% 0% / 0.05), 0px 2px 4px -1px hsl(0 0% 0% / 0.05);
--shadow-lg: 0px 1px 4px 0px hsl(0 0% 0% / 0.05), 0px 4px 6px -1px hsl(0 0% 0% / 0.05);
```

---

## 2. Typography

### Font Stack
```css
--font-sans: Outfit, ui-sans-serif, system-ui, sans-serif;
--font-serif: Merriweather, ui-serif, serif;
--font-mono: JetBrains Mono, ui-monospace, monospace;
```

### Text Sizing Scale

| Class      | Size | Use               |
|------------|------|-------------------|
| `text-xs`  | 12px | Labels, captions  |
| `text-sm`  | 14px | Secondary body    |
| `text-base`| 16px | Primary body      |
| `text-lg`  | 18px | Subheadings       |
| `text-xl`  | 20px | Section headings  |
| `text-2xl` | 24px | Card titles       |

### Font Weight
```
font-normal    → 400
font-medium    → 500
font-semibold  → 600
font-bold      → 700
font-extrabold → 800
```

---

## 3. Border Radius
```
--radius: 0.75rem (12px)  — base
rounded-sm = calc(--radius - 4px) = 8px
rounded-md = calc(--radius - 2px) = 10px
rounded-lg = --radius              = 12px
rounded-xl                         = 16px  (cards, dropdowns)
```

---

## 4. Tailwind Config Extensions
```js
theme: {
  extend: {
    colors: {
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
      secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
      muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
      accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
      destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
      border: 'var(--border)',
      input: 'var(--input)',
      ring: 'var(--ring)',
      card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
      popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
      sidebar: { DEFAULT: 'var(--sidebar)', foreground: 'var(--sidebar-foreground)' },
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
    fontFamily: {
      sans: ['var(--font-sans)'],
      serif: ['var(--font-serif)'],
      mono: ['var(--font-mono)'],
    },
    boxShadow: {
      panel: 'var(--shadow-md)',
      canvas: 'var(--shadow-lg)',
    },
  },
  darkMode: ['class'],  // toggled via .dark class on <html>
}
```

---

## 5. Component Patterns

### Button (CVA)
```tsx
// Sizes
xs:      h-6 px-2 gap-1 text-xs rounded-[min(var(--radius-md),10px)]
sm:      h-7 px-2.5 gap-1 text-[0.8rem]
default: h-8 px-2.5 gap-1.5
lg:      h-9 px-2.5 gap-1.5
icon:    size-8   (icon-xs: size-6 / icon-sm: size-7 / icon-lg: size-9)

// Variants
default:     bg-primary text-primary-foreground
outline:     border border-border bg-background hover:bg-muted
secondary:   bg-secondary text-secondary-foreground
ghost:       hover:bg-muted
destructive: bg-destructive/10 text-destructive hover:bg-destructive/20
link:        text-primary underline-offset-4 hover:underline

// States
focus-visible: border-ring ring-3 ring-ring/50
active:        translate-y-px
disabled:      pointer-events-none opacity-50

// Icon auto-sizing
[&_svg:not([class*='size-'])]:size-4
[&_svg]:pointer-events-none
[&_svg]:shrink-0
```

### Input
```
h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base
transition-colors placeholder:text-muted-foreground
focus-visible: border-ring ring-3 ring-ring/50
disabled: bg-input/50 opacity-50 cursor-not-allowed
dark: bg-input/30
```

### Card
```
flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm
text-card-foreground ring-1 ring-foreground/10

  CardHeader:  px-4 grid auto-rows-min gap-1
  CardTitle:   font-heading text-base font-medium leading-snug
  CardDesc:    text-sm text-muted-foreground
  CardContent: px-4
  CardFooter:  border-t bg-muted/50 p-4 flex items-center
```

### Dialog
```
Overlay:  fixed inset-0 z-50 bg-black/10 backdrop-blur-xs
Content:  fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
          grid gap-4 rounded-xl bg-popover p-4 ring-1 ring-foreground/10
Open:     data-open:animate-in fade-in-0 zoom-in-95 duration-100
Close:    data-closed:animate-out fade-out-0 zoom-out-95 duration-100
```

### Dropdown Menu
```
Content:  min-w-32 rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10
Item:     px-1.5 py-1 text-sm rounded-md focus:bg-accent
Label:    px-1.5 py-1 text-xs font-medium text-muted-foreground
Separator: h-px bg-border my-1
```

### Tooltip
```
Content: inline-flex rounded-md bg-foreground px-3 py-1.5 text-xs text-background
Arrow:   size-2.5 rotate-45 bg-foreground
```

### Separator
```
Horizontal: h-px w-full bg-border
Vertical:   w-px self-stretch bg-border
```

### Textarea
```
flex field-sizing-content min-h-16 w-full rounded-lg border border-input
bg-transparent px-2.5 py-2 text-base transition-colors
focus-visible: border-ring ring-3 ring-ring/50
dark: bg-input/30
```

---

## 6. Layout & Spacing Patterns

```
Panel padding:      p-4 (16px)  /  p-3 (12px) tight
Standard gaps:      gap-1 (4px) / gap-2 (8px) / gap-3 (12px) / gap-4 (16px)
Flex center row:    flex items-center gap-2
Flex fill:          flex-1 min-w-0
Full height stack:  flex flex-col h-full
Sidebar width:      w-3/4 with slide-in animation
Subtle divider:     ring-1 ring-foreground/10
Hard divider:       h-px bg-border  /  w-px bg-border
```

---

## 7. Animations & Transitions

```
transition-colors / duration-100 / duration-200     — color changes
data-open:animate-in / data-closed:animate-out      — modal enter/exit
fade-in-0 / fade-out-0                              — opacity
zoom-in-95 / zoom-out-95                            — scale
slide-in-from-top-2 / slide-in-from-bottom-2        — translate
backdrop-blur-xs                                     — frosted glass overlays
active:translate-y-px                               — button press
```

---

## 8. Icons (lucide-react)

Standard 16px icons set via `[&_svg:not([class*='size-'])]:size-4`.

Common icons used: `PlusIcon`, `TrashIcon`, `CopyIcon`, `ChevronDownIcon`, `CheckIcon`, `XIcon`, `Settings2Icon`, `PaletteIcon`, `EyeIcon`, `LayersIcon`, `SaveIcon`, `DownloadIcon`, `UploadIcon`.

---

## 9. Available UI Components (`src/components/ui/`)

```
button.tsx          — CVA variants: default, outline, secondary, ghost, destructive, link
input.tsx           — text input
textarea.tsx        — multi-line text area
card.tsx            — card with header, title, description, content, footer
dialog.tsx          — modal with overlay + backdrop blur
dropdown-menu.tsx   — context/dropdown menu
select.tsx          — select dropdown
sheet.tsx           — side drawer panel
separator.tsx       — horizontal/vertical divider
tabs.tsx            — tab navigation
tooltip.tsx         — hover tooltip with arrow
scroll-area.tsx     — scrollable region with custom scrollbar
sonner.tsx          — toast notifications
```

---

## 10. Design Aesthetic

- **Minimal and professional** — content-first, no decorative chrome
- **Muted backgrounds** with a single warm golden-orange primary accent
- **Subtle elevation** — thin `ring-1 ring-foreground/10` instead of heavy borders or drop shadows
- **Small, deliberate motion** — 100–200ms transitions, press effects, no flashy animations
- **Dark mode first-class** — all tokens switch automatically via `.dark` on `<html>`
- **Accessible** — high contrast ratios, always-visible focus rings (`ring-3 ring-ring/50`)
