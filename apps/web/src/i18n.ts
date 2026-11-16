/**
 * i18n-ready string table. Deliberately dependency-free for Phase 0: every
 * user-facing string lives here so Phase 6 can swap this module for i18next
 * without touching components. Interpolation uses `{name}` placeholders.
 */
const en = {
  'app.messages': 'Messages',
  'app.privateSpace': 'Your private space',
  'app.search': 'Search conversations',
  'app.recent': 'Recent',
  'app.newChat': 'Start a new conversation',
  'app.myIdentity': 'My identity',
  'app.connected': 'Connected peer-to-peer',
  'chat.placeholder': 'Write an encrypted message…',
  'chat.send': 'Send message',
  'chat.encryptionNote': '🔒 Messages are end-to-end encrypted · Typing indicators are off',
  'chat.verified': 'Safety number verified',
  'chat.unverified': 'Not verified — tap to compare',
  'chat.noSelection': 'No conversation selected',
  'theme.toLight': 'Switch to light theme',
  'theme.toDark': 'Switch to dark theme',
} as const;

export type StringKey = keyof typeof en;

const tables: Record<string, Partial<Record<StringKey, string>>> = { en };

/** Translate a key, substituting `{placeholder}` values. Falls back to English. */
export function t(key: StringKey, values?: Record<string, string | number>, language = 'en'): string {
  const template = tables[language]?.[key] ?? en[key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in values ? String(values[name]) : `{${name}}`,
  );
}

/** Current UI language; Phase 6 derives this from navigator.languages. */
export const currentLanguage = 'en';
