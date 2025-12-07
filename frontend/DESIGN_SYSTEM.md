# Chronosift Design System

## Overview
The Chronosift design system is inspired by modern SaaS applications with a professional gradient theme, using the Inter font family for clean, legible typography.

## Typography

### Font Family
- **Primary**: Inter (400, 500, 600, 700, 800 weights)
- **Monospace**: SF Mono, Monaco, Cascadia Code, Roboto Mono

### Font Sizes
- **Hero**: 3rem (48px) - font-weight: 800
- **H1**: 2.5rem (40px) - font-weight: 800
- **H2**: 2rem (32px) - font-weight: 700
- **H3**: 1.5rem (24px) - font-weight: 700
- **H4**: 1.25rem (20px) - font-weight: 600
- **Body Large**: 1.125rem (18px)
- **Body**: 1rem (16px)
- **Body Small**: 0.9375rem (15px)
- **Caption**: 0.875rem (14px)
- **Fine Print**: 0.75rem (12px)

## Color Palette

### Primary Colors
```css
--primary-purple: #6B2D8F     /* Deep purple for headers */
--primary-magenta: #B83280    /* Magenta for accents */
--primary-navy: #1A2332       /* Dark navy for text */
--primary-dark-blue: #0F1B2E  /* Very dark blue backgrounds */
```

### Accent Colors
```css
--accent-blue: #2563EB        /* Primary interactive elements */
--accent-light-blue: #3B82F6  /* Hover states */
--accent-cyan: #00A9E0        /* Info, links */
--accent-teal: #0891B2        /* Success alternative */
--accent-green: #10B981       /* Success states */
--accent-red: #DC2626         /* Error, delete actions */
--accent-pink: #E94B8B        /* CTAs, important actions */
```

### Neutral Grayscale
```css
--gray-50: #F9FAFB          /* Lightest backgrounds */
--gray-100: #F3F4F6         /* Section backgrounds */
--gray-200: #E5E7EB         /* Borders */
--gray-300: #D1D5DB         /* Disabled states */
--gray-400: #9CA3AF         /* Placeholders */
--gray-500: #6B7280         /* Secondary text */
--gray-600: #4B5563         /* Muted text */
--gray-700: #374151         /* Body text */
--gray-800: #1F2937         /* Dark text */
--gray-900: #111827         /* Headings, primary text */
```

### Semantic Colors
```css
--success: var(--accent-green)
--warning: #F59E0B
--error: var(--accent-red)
--info: var(--accent-cyan)
```

## Gradients

### Primary Gradient
Used for hero sections, major CTAs, and key visual elements:
```css
--gradient-primary: linear-gradient(135deg, #6B2D8F 0%, #B83280 50%, #1A2332 100%)
```

### Accent Gradient
For icons, badges, and secondary elements:
```css
--gradient-accent: linear-gradient(135deg, #0891B2 0%, #00A9E0 100%)
```

### Success Gradient
For positive actions and confirmations:
```css
--gradient-success: linear-gradient(135deg, #10B981 0%, #0891B2 100%)
```

## Shadows

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05)
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08)
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12)
--shadow-xl: 0 12px 40px rgba(0, 0, 0, 0.15)
```

## Border Radius

```css
--radius-sm: 4px    /* Small elements, inputs */
--radius-md: 6px    /* Buttons, badges */
--radius-lg: 8px    /* Cards, modals */
--radius-xl: 12px   /* Large cards, hero elements */
--radius-2xl: 16px  /* Containers, sections */
```

## Transitions

```css
--transition-fast: 0.15s ease
--transition-base: 0.2s ease
--transition-slow: 0.3s ease
```

## Component Styling Guidelines

### Buttons

#### Primary Button
```css
background: var(--accent-pink);
color: white;
padding: 16px 32px;
border-radius: var(--radius-lg);
font-weight: 600;
transition: var(--transition-base);

&:hover {
  background: var(--primary-magenta);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

#### Secondary Button
```css
background: transparent;
color: var(--accent-blue);
border: 2px solid var(--accent-blue);
padding: 14px 30px;
border-radius: var(--radius-lg);
font-weight: 600;

&:hover {
  background: rgba(37, 99, 235, 0.1);
}
```

#### Ghost Button
```css
background: transparent;
color: var(--gray-700);
padding: 12px 24px;

&:hover {
  background: var(--gray-100);
}
```

### Cards

#### Standard Card
```css
background: white;
border-radius: var(--radius-xl);
padding: 32px;
box-shadow: var(--shadow-md);
border: 2px solid transparent;
transition: var(--transition-slow);

&:hover {
  border-color: var(--accent-blue);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

#### Glass Card (for overlays)
```css
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: var(--radius-xl);
padding: 24px;
```

### Navigation

```css
background: white;
border-bottom: 1px solid var(--gray-200);
position: sticky;
top: 0;
z-index: 100;
box-shadow: var(--shadow-sm);
```

### Inputs

```css
padding: 12px 16px;
border: 1px solid var(--gray-300);
border-radius: var(--radius-md);
font-size: 1rem;
transition: var(--transition-fast);

&:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

### Tables

```css
background: white;
border: 1px solid var(--gray-200);
border-radius: var(--radius-lg);

thead {
  background: var(--gray-50);
  border-bottom: 2px solid var(--gray-200);
}

th {
  padding: 12px;
  font-weight: 600;
  color: var(--gray-900);
  text-align: left;
}

td {
  padding: 12px;
  border-bottom: 1px solid var(--gray-100);
  color: var(--gray-700);
}

tr:hover {
  background: var(--gray-50);
}
```

### Modals

```css
background: white;
border-radius: var(--radius-2xl);
padding: 40px;
box-shadow: var(--shadow-xl);
max-width: 900px;
```

### Badges

```css
padding: 4px 12px;
border-radius: var(--radius-md);
font-size: 0.875rem;
font-weight: 600;
display: inline-block;

/* Success */
background: rgba(16, 185, 129, 0.1);
color: var(--accent-green);

/* Warning */
background: rgba(245, 158, 11, 0.1);
color: var(--warning);

/* Error */
background: rgba(220, 38, 38, 0.1);
color: var(--error);

/* Info */
background: rgba(0, 169, 224, 0.1);
color: var(--info);
```

## Spacing Scale

Use consistent spacing based on 4px increments:

```
4px   (0.25rem)
8px   (0.5rem)
12px  (0.75rem)
16px  (1rem)
20px  (1.25rem)
24px  (1.5rem)
32px  (2rem)
40px  (2.5rem)
48px  (3rem)
64px  (4rem)
80px  (5rem)
```

## Layout Patterns

### Container
```css
max-width: 1200px;
margin: 0 auto;
padding: 0 24px;
```

### Section
```css
padding: 80px 24px;
```

### Grid Layout (Responsive Cards)
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
gap: 24px;
```

## Accessibility

- All interactive elements must have `:focus` states with visible outlines
- Maintain WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Use semantic HTML elements
- Provide alt text for images
- Ensure keyboard navigation works throughout

## Animation Principles

- Use subtle animations with easing functions
- Transform effects should lift elements (`translateY(-2px)` to `-4px`)
- Hover transitions should be quick (0.2s)
- Page transitions can be slower (0.3s)
- Avoid distracting animations on data-heavy pages

## Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 640px) { }

/* Tablet */
@media (max-width: 768px) { }

/* Desktop */
@media (max-width: 1024px) { }

/* Large Desktop */
@media (max-width: 1280px) { }
```

## Usage Examples

See the HubSpot microsite reference for full implementation examples of:
- Hero sections with gradient backgrounds
- Service/feature cards with hover effects
- Stats cards with glass morphism
- Process steps with numbered indicators
- Trust badges and certification displays
- CTA sections with compelling copy

## Best Practices

1. **Consistency**: Use the design system variables throughout
2. **Hierarchy**: Establish clear visual hierarchy with size, weight, and color
3. **Whitespace**: Don't be afraid of whitespace - it improves readability
4. **Progressive Enhancement**: Start with mobile, enhance for desktop
5. **Performance**: Optimize gradients and shadows for performance
6. **Accessibility First**: Always consider keyboard navigation and screen readers
