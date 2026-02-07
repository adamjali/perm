# Animation Storyboard

> Complete animation catalog for PERM Tracker v2
> Last updated: 2026-02-06

---

## Design Principles

### 1. Snappy & Reactive First
Inspired by Linear.app, animations should feel instant and responsive. Users should never wait for animations to complete before interacting.

### 2. Performance Over Polish
GPU-accelerated transforms only. No layout-triggering properties. Smooth 60fps on all devices.

### 3. Accessibility via Reduced Motion
All animations respect `prefers-reduced-motion`. Users who prefer reduced motion get instant reveals with no transforms.

### 4. Consistent Timing Across Pages
Unified timing tokens ensure animations feel cohesive throughout the application.

---

## Animation Types

### Scroll Reveals

| Section | Trigger | Animation | Duration | Stagger |
|---------|---------|-----------|----------|---------|
| Hero | Immediate | fadeInUp | 0.4s spring | - |
| Features | 10% viewport | fadeInUp | spring(500,30) | 0.1s |
| How It Works | 10% viewport | fadeInUp | spring(500,30) | 0.1s |
| Showcase | 10% viewport | fadeInUp | spring(500,30) | 0.08s |
| FAQ | 10% viewport | fadeIn | spring(500,30) | - |
| Contact | 10% viewport | fadeInUp | spring(500,30) | - |

**Implementation Notes:**
- `fadeInUp`: `opacity: 0 → 1`, `translateY(24px) → 0`
- `fadeIn`: `opacity: 0 → 1` only
- Spring physics: `stiffness: 500`, `damping: 30`
- Trigger threshold: `amount: 0.1` (10% visible)

---

### Micro-interactions

| Element | Trigger | Animation | Duration |
|---------|---------|-----------|----------|
| Card | Hover | lift + shadow | 0.15s |
| Button | Hover | scale(1.02) | 0.1s |
| Button | Active | translateY(2px) | 0.05s |
| Link | Hover | underline | 0.15s |
| FAQ item | Click | height expand | 0.3s |

**CSS Implementation:**

```css
/* Card hover */
.card {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.15);
}

/* Button hover */
.btn {
  transition: transform 0.1s ease-out;
}
.btn:hover {
  transform: scale(1.02);
}
.btn:active {
  transform: translateY(2px);
  transition-duration: 0.05s;
}

/* Link hover */
.link {
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-size: 0% 1px;
  background-position: 0 100%;
  background-repeat: no-repeat;
  transition: background-size 0.15s ease-out;
}
.link:hover {
  background-size: 100% 1px;
}
```

---

### Content Hub Animations

| Element | Trigger | Animation | Duration |
|---------|---------|-----------|----------|
| ScreenshotFigure | 10% viewport | fadeInUp | 0.5s ease [0.4,0,0.2,1] |

**Implementation:**
```tsx
// ScreenshotFigure fade-up (src/components/content/ScreenshotFigure.tsx)
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
  },
};
// Used with: whileInView="show", viewport={{ once: true, margin: "-40px" }}
```

---

### Parallax

| Element | Speed | Range | Mobile |
|---------|-------|-------|--------|
| Shape 1 (large) | 0.05x | slow | Disabled |
| Shape 2 (medium) | 0.03x | mid | Disabled |
| Shape 3 (small) | 0.02x | fast | Disabled |

**Implementation:**
- Uses `useScrollY` hook with throttled RAF updates
- Transform: `translateY(scrollY * speed)`
- Shapes hidden on mobile via `hidden md:block`
- No parallax on touch devices for battery/performance

---

### Page Transitions

| Transition | Animation | Duration |
|------------|-----------|----------|
| Route change | fadeIn | 0.2s |
| Modal open | fadeIn + scale(0.95 → 1) | 0.2s |
| Modal close | fadeOut + scale(1 → 0.95) | 0.15s |

**Modal Implementation:**

```tsx
// Framer Motion variants
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: 'easeIn' }
  }
};
```

---

## Mobile Behavior

| Property | Desktop | Mobile |
|----------|---------|--------|
| Parallax | Enabled | Disabled (`hidden md:block`) |
| Stagger delays | 0.1s | 0.05s (halved) |
| Transform distance | 24px | 12px (halved) |
| Spring stiffness | 500 | 600 (snappier) |
| Hover effects | Full | Touch-optimized |

**Mobile Optimizations:**
- Reduced transform distances prevent jarring movements on small screens
- Higher spring stiffness makes animations feel more responsive on touch
- Hover states adapted for touch with `:active` fallbacks
- Stagger delays halved to prevent content feeling slow to appear

---

## Accessibility

### prefers-reduced-motion

When `prefers-reduced-motion: reduce` is set:
- All scroll reveals: Instant (no transforms, immediate opacity)
- Micro-interactions: Instant state changes
- Parallax: Completely disabled
- Page transitions: Instant route changes

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Focus States

- Ring outline: 3px offset, primary color
- Tab order preserved in all animated elements
- Focus visible only on keyboard navigation (`:focus-visible`)

```css
.interactive:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Keyboard Navigation

- All interactive elements accessible via Tab
- Animation timing does not block keyboard navigation
- Skip links for main content sections

---

## Performance Notes

### GPU-Accelerated Properties Only

All animations use compositor-friendly properties:
- `transform` (translate, scale, rotate)
- `opacity`

**Never animate:**
- `width`, `height` (triggers layout)
- `top`, `left`, `right`, `bottom` (triggers layout)
- `margin`, `padding` (triggers layout)
- `border-width` (triggers layout)
- `box-shadow` (triggers paint - use opacity fade instead)

### will-change Usage

Applied sparingly to frequently animated elements:
```css
.parallax-shape {
  will-change: transform;
}
.modal-overlay {
  will-change: opacity;
}
```

**Remove after animation completes** to free GPU memory.

### Throttled Scroll Handlers

All scroll-based animations use requestAnimationFrame ticking:

```typescript
const useScrollY = () => {
  const [scrollY, setScrollY] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollY;
};
```

### Intersection Observer for Reveals

Using native Intersection Observer (via Framer Motion's `whileInView`) instead of scroll event listeners:

```tsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.1 }}
  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
>
  {content}
</motion.div>
```

---

## Animation Tokens (CSS Variables)

```css
:root {
  /* Durations */
  --duration-instant: 0.05s;
  --duration-fast: 0.1s;
  --duration-normal: 0.15s;
  --duration-slow: 0.3s;
  --duration-slower: 0.4s;

  /* Easings */
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in: cubic-bezier(0.32, 0, 0.67, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* Spring equivalents (approximations for CSS) */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Distances */
  --reveal-distance: 24px;
  --reveal-distance-mobile: 12px;

  /* Staggers */
  --stagger-default: 0.1s;
  --stagger-fast: 0.08s;
  --stagger-mobile: 0.05s;
}
```

---

## Quick Reference

### Adding a New Scroll Reveal

```tsx
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';

export function NewSection() {
  return (
    <motion.section
      {...fadeInUp}
      viewport={{ once: true, amount: 0.1 }}
    >
      {/* content */}
    </motion.section>
  );
}
```

### Adding Staggered Children

```tsx
import { staggerContainer, staggerItem } from '@/lib/animations';

export function StaggeredList({ items }) {
  return (
    <motion.ul {...staggerContainer}>
      {items.map((item, i) => (
        <motion.li key={i} {...staggerItem}>
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### Respecting Reduced Motion

```tsx
import { useReducedMotion } from 'framer-motion';

export function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* content */}
    </motion.div>
  );
}
```
