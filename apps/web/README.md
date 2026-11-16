# @veil/web

The browser client for Veil. This Phase 0 shell demonstrates the core
conversation layout with local demo data; Phase 1 wires in identity, encrypted
storage, and a mocked `MessageTransport` for UI development.

- React 19 + Vite 8 + Tailwind 4 + Zustand
- Dark/light theme persisted locally
- i18next-ready; WCAG 2.1 AA keyboard/focus semantics
- CSP: no inline scripts, no eval, no remote code

Run `pnpm --filter @veil/web dev` from the repo root.
