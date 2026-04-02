---
name: Laravel + Vue UI/UX Expert
description: Expert guidelines for building modern, high-fidelity UI/UX using Laravel and Vue.js.
---

# Laravel + Vue Skill

## Core Philosophy
- **Inertia.js Monolith**: Build a modern SPA without the API complexity. Use Laravel Router + Controllers returning `Inertia::render`.
- **Vue 3 Composition API**: Use `<script setup>` for all components.
- **Tailwind CSS**: The default styling engine. Use `headlessui` for accessible JS components.
- **Full Stack Polish**: The user shouldn't know it's a monolith. It should feel like a dedicated native app.

## Protocol

### 1. Project Setup
- **Directory Structure**:
  - `resources/js/Components/Atoms` (Button, Input)
  - `resources/js/Components/Molecules` (FormGroup, Card)
  - `resources/js/Layouts` (Persistent Layouts)
  - `resources/js/Pages` (Inertia Views)
- **Aliases**: Configure Vite aliases (`@` for `resources/js`).

### 2. Branding & Aesthetics
- **Typography**: Use modern sans-serifs like *Inter*, *Plus Jakarta Sans*, or *Outfit*.
- **Glassmorphism**: Use `backpack-blur-md` with semi-transparent whites/blacks for overlays/modals.
- **Shadows**: Use colored shadows for depth (e.g., `shadow-indigo-500/20`).
- **Dark Mode**: Fully support `dark:` variants. Default to system preference.

### 3. Interaction Design
- **Feedback**: trigger Toast notifications on server redirects (Inertia flash messages).
- **States**: Every interactive element must have `:hover`, `:active`, `:focus-visible`, and `:disabled` states.
- **Transitions**: Animate all state changes (colors, transforms) with `duration-200 ease-in-out`.

## Visual Reproduction Guidelines (Image-to-Code)
- **Shadows**: Extend tailwind.config.js for named complex shadows.
- **Inputs**: Match border colors and focus rings exactly.
    - *Code*: `border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10`
- **Avatars**: Use `rounded-full ring-2 ring-white` for overlaps.

## Accessibility Guidelines
- **Semantic HTML**: Use proper tags (`<button>`, not `<div>`).
- **Keyboard Navigation**: Ensure all interactive elements are reachable via Tab.
- **Focus Indicators**: Never suppress outline without a custom focus ring (`ring-2 ring-offset-2`).
- **ARIA**: Use `aria-label` for icon-only buttons.
- **Screen Readers**: Test with basic screen reader flow.

## Performance & Optimization
- **Caching**: Use Redis to cache expensive queries.
- **Queue**: Offload emails and reports to `database` or `redis` queues.
- **SSR**: Enable Inertia SSR for SEO critical pages.
- **Vite**: Use `splitVendorChunkPlugin` for better caching.

## Security Best Practices
- **Validation**: Strict FormRequest validation on Laravel side.
- **Sanitization**: Vue auto-escapes, but be careful with `v-html`.
- **Authorization**: Use Laravel Policies (`can('update', $post)`).

## Specific: Real-time Broadcasting
Use **Laravel Reverb** (or Pusher) + **Laravel Echo**:
```javascript
Echo.private(`chat.${roomId}`)
    .listen('MessageSent', (e) => {
        messages.value.push(e.message);
    });
```

## Testing & Quality Assurance
- **Unit/Component**: **Vitest** + **Vue Test Utils** for Vue components.
- **Feature/E2E**: **Pest** (PHP) for backend and **Playwright** for E2E flows.
- **Linting**: ESLint + Prettier (Frontend), Pint (Backend).

## Common Pitfalls
- **Over-fetching**: Pass only necessary data to Inertia pages to keep payloads small.
- **Prop Drilling**: Use separate composables or Pinia instead of passing props 5 levels deep.
- **Ignoring Loading States**: Always show a loading indicator or disable buttons during form submission (`form.processing`).

## Code Snippets

### 1. Modern Button (Vue)
```vue
<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

interface Props {
  variant?: 'primary' | 'secondary' | 'danger';
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  type: 'button',
  disabled: false,
});

const baseClass = "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";

const variants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 focus:ring-indigo-500",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30 focus:ring-red-500"
};
</script>

<template>
  <Link v-if="href" :href="href" :class="[baseClass, variants[variant]]">
    <slot />
  </Link>
  <button v-else :type="type" :disabled="disabled" :class="[baseClass, variants[variant]]">
    <slot />
  </button>
</template>
```

### 2. Form Handling (Inertia)
```vue
<script setup lang="ts">
import { useForm } from '@inertiajs/vue3';
import TextInput from '@/Components/Atoms/TextInput.vue';
import PrimaryButton from '@/Components/Atoms/PrimaryButton.vue';

const form = useForm({
    email: '',
    password: '',
    remember: false,
});

const submit = () => {
    form.post(route('login'), {
        onFinish: () => form.reset('password'),
    });
};
</script>

<template>
    <form @submit.prevent="submit" class="space-y-6">
        <TextInput 
            v-model="form.email" 
            label="Email" 
            :error="form.errors.email" 
            type="email" 
            autocomplete="username" 
        />
        
        <TextInput 
            v-model="form.password" 
            label="Password" 
            :error="form.errors.password" 
            type="password"
            autocomplete="current-password"
        />

        <div class="flex items-center justify-end">
            <PrimaryButton :disabled="form.processing">
                Login
            </PrimaryButton>
        </div>
    </form>
</template>
```
