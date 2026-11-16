import type { FormEvent, KeyboardEvent } from 'react';

import { useVeilStore } from '../store';

/** Composer; enters send, Shift+Enter inserts a newline. */
export function Composer() {
  const draft = useVeilStore((s) => s.draft);
  const setDraft = useVeilStore((s) => s.setDraft);
  const sendMessage = useVeilStore((s) => s.sendMessage);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <form className="composer-wrap" onSubmit={submit}>
      <p className="encryption-note">🔒 Messages are end-to-end encrypted · Typing indicators are off</p>
      <div className="composer">
        <button className="icon-button" type="button" aria-label="Attach a file (coming soon)" disabled>
          ＋
        </button>
        <label className="sr-only" htmlFor="message-composer">
          Write a message
        </label>
        <textarea
          id="message-composer"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder="Write an encrypted message…"
          maxLength={32766}
        />
        <button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim()}>
          ➤
        </button>
      </div>
    </form>
  );
}
