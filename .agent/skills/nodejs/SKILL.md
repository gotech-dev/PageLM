---
name: Node.js Web UI Expert
description: Expert guidelines for building robust, server-rendered UIs or raw web interfaces/dashboards using Node.js.
---

# Node.js Skill

## Core Philosophy
- **SSR First**: Render HTML on the server (EJS/Pug/Handlebars) for speed and SEO.
- **Progressive Enhancement**: JS should enhance the experience, not define it. The site should work (mostly) without JS.
- **HTMX**: For dynamic interactivity without the framework weight. Use attributes over scripts.
- **Alpine.js**: For purely client-side state (modals, dropdowns) where HTMX is overkill.

## Protocol

### 1. Project Structure
- `views/partials/`: Reusable headers, footers, card components.
- `public/`: Static assets (ensure high cache-control usage).
- `routes/`: Standard RESTful routes that return partials when requested via HTMX headers.

### 2. Interaction
- **AJAX without JS**: Use `hx-get`, `hx-post` to swap content.
- **Feedback**: Use `hx-indicator` to show spinners during network requests.
- **Transitions**: Use simple CSS transitions or HTMX view transitions API.

## Visual Reproduction Guidelines (Image-to-Code)
- **CSS Frameworks**: If using Bootstrap, override `$box-shadow` variables. If Tailwind, use arbitrary values.
- **Charts/Data**: Use libraries like `Chart.js` with custom canvas rendering to match thick lines or gradients from images.
- **Typography**: Set explicit line-heights (`leading-tight`) to match dense information displays.

## Accessibility Guidelines
- **Forms**: Associate labels with inputs strictly (`for="id"`).
- **Focus Management**: When swapping content via HTMX, ensure focus is handled (e.g., `hx-swap-oob` or manually focusing logic).
- **Semantic HTML**: `<main>`, `<nav>`, `<article>` are non-negotiable.

## Performance & Optimization
- **Process Manager**: Use **PM2** with `cluster` mode to utilize all CPU cores.
- **Compression**: Use `compression` middleware (Gzip/Brotli).
- **Rate Limit**: Implement `express-rate-limit` for DDoS protection.
- **Logging**: Use `pino` or `winston` (async logging, don't use console.log in prod).

## Security Best Practices
- **Helmet**: Always use `helmet()` middleware to set secure HTTP headers.
- **Input Cleaning**: Sanitize all inputs from `req.body` and `req.query`.
- **CSRF**: Use `csurf` or similar token strategy for non-GET requests.

## Specific: Tooling
- **HTMX** for "HTML over the wire" interactions.
- **Alpine.js** for "jQuery replacement" - light interactivity.

## Testing & Quality Assurance
- **Unit**: **Jest** or **Mocha/Chai** for helper functions/controllers.
- **Integration**: **Supertest** to verify route HTML responses.
- **Validation**: Use **Joi** or **Zod** to validate form inputs before rendering error states.

## Common Pitfalls
- **Full Refreshes**: Not using HTMX buffers properly, causing full page reloads where partials were intended.
- **XSS Vulnerabilities**: Always escape output in templates (EJS does this by default with `<%= %>`, be careful with `<%- %>`).
- **Messy Templates**: Extract logic to helper functions instead of writing complex JS inside EJS tags.

## Code Snippets

### 1. Interactive Search (EJS + HTMX)
```html
<!-- Search Container -->
<div class="relative max-w-lg mx-auto" x-data="{ query: '' }">
  <label for="search" class="sr-only">Search Users</label>
  <div class="relative">
      <input 
          type="text" 
          id="search"
          name="search"
          class="w-full px-4 py-3 pl-10 rounded-full border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 transition-all shadow-sm"
          placeholder="Search users..."
          hx-get="/search/results" 
          hx-trigger="keyup changed delay:300ms" 
          hx-target="#search-results"
          hx-indicator="#loading-indicator"
          x-model="query"
      >
      <!-- Search Icon -->
      <span class="absolute left-3 top-3.5 text-slate-400">
          <svg width="20" height="20" fill="none" stroke="currentColor" ...>...</svg>
      </span>
      <!-- Loading Indicator -->
      <span id="loading-indicator" class="htmx-indicator absolute right-3 top-3.5">
          <svg class="animate-spin h-5 w-5 text-indigo-500" ...>...</svg>
      </span>
  </div>
</div>

<!-- Dynamic Results container -->
<div id="search-results" class="mt-4 grid gap-4 transition-all duration-300 ease-in-out" aria-live="polite">
   <!-- Server returns partials here -->
   <%- include('partials/empty-state', { message: 'Start typing to search...' }) %>
</div>
```

### 2. Modal (Alpine.js)
```html
<div x-data="{ open: false }" @keydown.escape="open = false">
    <!-- Trigger -->
    <button @click="open = true" class="btn-primary">
        Open Settings
    </button>

    <!-- Modal Backdrop -->
    <div x-show="open" 
         x-transition.opacity
         class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
         style="display: none;"></div>

    <!-- Modal Content -->
    <div x-show="open"
         x-transition:enter="transition ease-out duration-300"
         x-transition:enter-start="opacity-0 translate-y-4 scale-95"
         x-transition:enter-end="opacity-100 translate-y-0 scale-100"
         x-trap="open"
         class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="display: none;">
         
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <h2 class="text-xl font-bold mb-4">Settings</h2>
            <p class="text-gray-600">Manage your preferences here.</p>
            
            <div class="mt-6 flex justify-end gap-3">
                <button @click="open = false" class="px-4 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
                <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
            </div>
        </div>
    </div>
</div>
```
