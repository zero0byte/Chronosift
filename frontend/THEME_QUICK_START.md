# Theme Quick Start Guide

## Using the New Design System

The Chronosift design system is now available via CSS custom properties. Use these variables instead of hardcoded values for consistency and maintainability.

## Quick Examples

### Colors

```tsx
// ✅ Good - Using CSS variables
<div style={{ color: 'var(--gray-700)', backgroundColor: 'var(--gray-50)' }}>

// ❌ Avoid - Hardcoded colors
<div style={{ color: '#374151', backgroundColor: '#F9FAFB' }}>
```

### Buttons

```tsx
// Primary button with gradient
<button style={{
  background: 'var(--accent-pink)',
  color: 'white',
  padding: '16px 32px',
  borderRadius: 'var(--radius-lg)',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'var(--transition-base)'
}}>
  Click Me
</button>

// Secondary button with outline
<button style={{
  background: 'transparent',
  color: 'var(--accent-blue)',
  padding: '14px 30px',
  borderRadius: 'var(--radius-lg)',
  border: '2px solid var(--accent-blue)',
  fontWeight: 600,
  cursor: 'pointer'
}}>
  Learn More
</button>
```

### Cards

```tsx
// Standard card with hover effect
<div style={{
  background: 'white',
  borderRadius: 'var(--radius-xl)',
  padding: '32px',
  boxShadow: 'var(--shadow-md)',
  border: '2px solid transparent',
  transition: 'var(--transition-slow)'
}}>
  Card content
</div>

// Add hover state via CSS or inline onMouseEnter/onMouseLeave
```

### Gradients

```tsx
// Hero section with primary gradient
<div style={{
  background: 'var(--gradient-primary)',
  color: 'white',
  padding: '80px 24px',
  borderRadius: 'var(--radius-2xl)'
}}>
  <h1 style={{ 
    fontSize: '3rem', 
    fontWeight: 800,
    marginBottom: '24px'
  }}>
    Hero Title
  </h1>
</div>

// Icon with accent gradient
<div style={{
  background: 'var(--gradient-accent)',
  width: '56px',
  height: '56px',
  borderRadius: 'var(--radius-xl)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}>
  🚀
</div>
```

### Typography

```tsx
// Heading styles
<h1 style={{ 
  fontSize: '2.5rem',
  fontWeight: 800,
  color: 'var(--gray-900)',
  marginBottom: '16px',
  letterSpacing: '-0.02em'
}}>
  Section Title
</h1>

// Body text
<p style={{
  fontSize: '1rem',
  color: 'var(--gray-700)',
  lineHeight: 1.6
}}>
  Body text content
</p>

// Muted text
<span style={{
  fontSize: '0.875rem',
  color: 'var(--gray-600)'
}}>
  Secondary information
</span>
```

### Forms

```tsx
// Input field with focus state
<input
  type="text"
  placeholder="Enter text..."
  style={{
    width: '100%',
    padding: '12px 16px',
    border: '1px solid var(--gray-300)',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    transition: 'var(--transition-fast)'
  }}
  onFocus={(e) => {
    e.target.style.borderColor = 'var(--accent-blue)';
    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
  }}
  onBlur={(e) => {
    e.target.style.borderColor = 'var(--gray-300)';
    e.target.style.boxShadow = 'none';
  }}
/>
```

### Badges

```tsx
// Success badge
<span style={{
  padding: '4px 12px',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.875rem',
  fontWeight: 600,
  background: 'rgba(16, 185, 129, 0.1)',
  color: 'var(--success)'
}}>
  Active
</span>

// Error badge
<span style={{
  padding: '4px 12px',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.875rem',
  fontWeight: 600,
  background: 'rgba(220, 38, 38, 0.1)',
  color: 'var(--error)'
}}>
  Failed
</span>

// Info badge
<span style={{
  padding: '4px 12px',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.875rem',
  fontWeight: 600,
  background: 'rgba(0, 169, 224, 0.1)',
  color: 'var(--info)'
}}>
  Info
</span>
```

### Modals

```tsx
// Modal overlay
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}}>
  {/* Modal content */}
  <div style={{
    background: 'white',
    borderRadius: 'var(--radius-2xl)',
    padding: '40px',
    maxWidth: '900px',
    boxShadow: 'var(--shadow-xl)'
  }}>
    <h2>Modal Title</h2>
    <p>Modal content...</p>
  </div>
</div>
```

### Tables

```tsx
<table style={{
  width: '100%',
  background: 'white',
  border: '1px solid var(--gray-200)',
  borderRadius: 'var(--radius-lg)',
  borderCollapse: 'collapse'
}}>
  <thead style={{
    background: 'var(--gray-50)',
    borderBottom: '2px solid var(--gray-200)'
  }}>
    <tr>
      <th style={{
        padding: '12px',
        fontWeight: 600,
        textAlign: 'left',
        color: 'var(--gray-900)'
      }}>
        Header
      </th>
    </tr>
  </thead>
  <tbody>
    <tr style={{ borderBottom: '1px solid var(--gray-100)' }}>
      <td style={{
        padding: '12px',
        color: 'var(--gray-700)'
      }}>
        Data
      </td>
    </tr>
  </tbody>
</table>
```

## Color Reference

### When to Use Each Color

| Use Case | Color Variable | Example |
|----------|---------------|---------|
| Primary CTA | `--accent-pink` | Main action buttons |
| Links | `--accent-blue` or `--accent-cyan` | Hyperlinks, navigation |
| Success | `--success` or `--accent-green` | Confirmations, positive states |
| Error | `--error` or `--accent-red` | Errors, delete actions |
| Warning | `--warning` | Warnings, cautions |
| Info | `--info` or `--accent-cyan` | Information, tips |
| Headings | `--gray-900` or `--primary-navy` | Page titles, section headers |
| Body Text | `--gray-700` | Main content |
| Muted Text | `--gray-600` or `--gray-500` | Secondary info, timestamps |
| Borders | `--gray-200` or `--gray-300` | Dividers, input borders |
| Backgrounds | `--gray-50` or `--gray-100` | Sections, cards |

## Spacing Reference

Use multiples of 4px for consistency:

```tsx
// ✅ Good
<div style={{ padding: '16px', margin: '24px' }}>

// ❌ Avoid random values
<div style={{ padding: '17px', margin: '23px' }}>
```

Common spacing values:
- `4px` / `0.25rem` - Tiny gaps
- `8px` / `0.5rem` - Small gaps
- `12px` / `0.75rem` - Medium gaps
- `16px` / `1rem` - Standard padding
- `24px` / `1.5rem` - Section gaps
- `32px` / `2rem` - Large padding
- `48px` / `3rem` - Section padding
- `80px` / `5rem` - Major sections

## Tips for Migration

1. **Start with new features**: Apply the design system to new components first
2. **Update incrementally**: Refactor one component at a time
3. **Test thoroughly**: Ensure colors have sufficient contrast
4. **Use the variables**: Don't hardcode colors or sizes
5. **Be consistent**: Follow the patterns in DESIGN_SYSTEM.md

## Common Patterns

### Hover Effects

```tsx
// Lift on hover
const [isHovered, setIsHovered] = useState(false);

<div
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  style={{
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
    boxShadow: isHovered ? 'var(--shadow-lg)' : 'var(--shadow-md)',
    transition: 'var(--transition-slow)'
  }}
>
  Card with hover effect
</div>
```

### Glass Morphism (for overlays)

```tsx
<div style={{
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 'var(--radius-xl)',
  padding: '24px'
}}>
  Glass card content
</div>
```

### Gradient Text

```css
/* In your CSS file */
.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## Getting Help

- **Full documentation**: See `DESIGN_SYSTEM.md`
- **Update summary**: See `../THEME_UPDATE.md`
- **Reference design**: See `C:\Users\user01\Cascade Porjects\ir_form\hubspot-microsite-index.html`

## CSS Variables Cheat Sheet

```css
/* Colors */
var(--primary-purple)
var(--primary-magenta)
var(--primary-navy)
var(--accent-blue)
var(--accent-cyan)
var(--accent-green)
var(--accent-red)
var(--accent-pink)
var(--gray-50) through var(--gray-900)

/* Gradients */
var(--gradient-primary)
var(--gradient-accent)
var(--gradient-success)

/* Shadows */
var(--shadow-sm)
var(--shadow-md)
var(--shadow-lg)
var(--shadow-xl)

/* Border Radius */
var(--radius-sm)
var(--radius-md)
var(--radius-lg)
var(--radius-xl)
var(--radius-2xl)

/* Transitions */
var(--transition-fast)
var(--transition-base)
var(--transition-slow)
```
