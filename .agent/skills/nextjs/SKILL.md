---
name: Next.js UI/UX Expert
description: Expert guidelines for building premium, highly interactive UI/UX with Next.js and React.
---

# Next.js Skill

## Core Philosophy
- **Server Components (RSC)**: Fetch data on the server by default. Use `"use client"` only for interactivity (state, effects).
- **Tailwind CSS**: Use utility classes for 99% of styling. Use `clsx` or `cn` helper for conditional classes.
- **Framer Motion**: Use standard Framer Motion for all entering/exiting/layout animations.
- **Radix UI / Shadcn**: Use accessible primitives (Headless UI or Radix) for complex components (Dialogs, Popovers).

## Protocol

### 1. Setup & Dependencies
- **Styling**: `tailwind-merge` and `clsx` are mandatory utilties.
- **Icons**: **Lucide React** (standard) or Heroicons.
- **Fonts**: `next/font` (Optimization built-in).

## UI/UX Implementation Rules

### 1. Structure (App Router)
- **Layouts**: Use `layout.tsx` for persistent shells.
- **Loading**: Implement `loading.tsx` with skeleton screens that match the final layout structure.
- **Error Handling**: Custom `error.tsx` for graceful failure states and retry logic.

### 2. Aesthetics
- **Theme**: Define CSS variables in `globals.css` for centralized control of colors, radius, and spacing.
- **Backgrounds**: Use subtle gradients (mesh gradients) or noise textures to avoid "flat" white/dark pages.
- **Micro-interactions**: Hover cards, button taps (scale down), and focus rings.

### 3. Responsive Design
- Mobile-first approach.
- Use `hidden md:block` patterns for adapting navigation.
- Touch targets must be at least 44x44px on mobile.

## Visual Reproduction Guidelines (Image-to-Code)
- **Shadows**: Use Tailwind arbitrary values for exact matching if standard presets fail.
    - *Code*: `shadow-[0_8px_30px_rgb(0,0,0,0.12)]`
- **Glassmorphism (Frosted Glass)**:
    - *Code*: `backdrop-blur-md bg-white/30 border border-white/20 shadow-lg`
- **Gradients**: Use `bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500`.
- **Absolute Positioning**: Only use for overlays/badges. Use Flex/Grid for layout.

## Accessibility Guidelines
- **Radix UI**: Leverage Radix primitives (Dialog, Popover, Dropdown) which handle ARIA roles, focus management, and keyboard navigation automatically.
- **Colors**: Ensure WCAG AA contrast ratio (4.5:1).
- **Reduced Motion**: Respect `prefers-reduced-motion` media query in Framer Motion variants.

## Performance & Optimization
- **Images**: Always use `<Image>` component with defined size or `fill`.
- **Bundle Analysis**: Use `@next/bundle-analyzer` to detect large deps.
- **Server Actions**: Prefer Server Actions over API Routes for form mutations to reduce client JS.
- **PPR**: Explore Partial Prerendering (Experimental) for dynamic shells with static edges.
- **Fonts**: Use `next/font` with `subset` to reduce FOUT.

## Security Best Practices
- **XSS**: Sanitize rich text content if rendering HTML (`dompurify`).
- **Headers**: Configure `next.config.js` headers (Security headers, CSP).
- **Validation**: Use **Zod** for all Server Action inputs.

## Specific: Server Actions
```tsx
// actions.ts
'use server'
import { z } from 'zod';

export async function createUser(prevState: any, formData: FormData) {
  const schema = z.object({ email: z.string().email() });
  const parse = schema.safeParse({ email: formData.get('email') });
  
  if (!parse.success) return { error: parse.error.format() };
  // DB logic
  return { success: true };
}
```

## Testing & Quality Assurance
- **Unit Testing**: **Vitest** or **Jest** + **React Testing Library**.
- **E2E Testing**: **Playwright** (Preferred) or Cypress.
- **Lighthouse**: Regularly run LightHouse checks for Accessibility and SEO scores.

## Common Pitfalls
- **"use client" overuse**: Don't make the root layout a client component. Push client logic down the tree (`Leaf Components`).
- **Heavy Bundles**: Importing huge libraries into client components. Use dynamic imports (`next/dynamic`) for heavy interactive elements.
- **Layout Shift (CLS)**: Always specify width/height for images or use `next/image`.

## Code Snippets

### 1. Animated Feature Card (Framer Motion)
```tsx
'use client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
}

export const FeatureCard = ({ title, description, icon, className }: FeatureCardProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={cn(
        "group p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-shadow",
        className
      )}
    >
      <div className="mb-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 w-fit group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        {title}
      </h3>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
};
```

### 2. Accessible Form Input with Error
```tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    return (
      <div className="grid w-full items-center gap-1.5">
        {label && <Label htmlFor={id} className={error ? "text-red-500" : ""}>{label}</Label>}
        <input
          type={type}
          id={id}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus-visible:ring-red-500",
            className
          )}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {error && (
            <p id={`${id}-error`} className="text-xs font-medium text-red-500 animate-in slide-in-from-top-1 fade-in">
                {error}
            </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
```
