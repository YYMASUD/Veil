# @veil/ui

Shared React components and hooks for Veil clients (web now, desktop and
mobile wrappers later). Talks to the rest of the app exclusively through
`@veil/core` seams, so it can be developed and tested against mocked
`MessageTransport` / `MessageStore` implementations.

- Design tokens with dark and light themes.
- Accessible primitives targeting WCAG 2.1 AA (focus management, contrast,
  `aria-*` wiring, keyboard navigation).
- i18n-ready strings (i18next); no literal UI copy in components.

Status: placeholder (Phase 0). Components land from Phase 1 onward.
