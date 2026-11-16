import { useEffect, useRef } from 'react';

import { useVeilStore } from '../store';
import { Composer } from './Composer';

/** Main conversation pane: header, transcript, composer. */
export function ChatView() {
  const chats = useVeilStore((s) => s.chats);
  const activeChatId = useVeilStore((s) => s.activeChatId);
  const chat = chats.find((c) => c.id === activeChatId);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [chat?.messages.length]);

  if (!chat) {
    return (
      <section className="conversation" aria-label="Conversation">
        <div className="empty-state">
          <h2>No conversation selected</h2>
          <p>Pick a chat on the left, or start a new one with a contact&apos;s safety number.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="conversation" aria-label={`Conversation with ${chat.name}`}>
      <header className="conversation-head">
        <div className="peer">
          <span className={`avatar ${chat.avatarClass}`} aria-hidden="true">
            {chat.initials}
          </span>
          <div>
            <h2>{chat.name}</h2>
            <p>{chat.verified ? 'Safety number verified' : 'Not verified — tap to compare'}</p>
          </div>
        </div>
        <div className="head-actions">
          <button className="icon-button" type="button" aria-label="Verify safety number">
            ✓
          </button>
          <button className="icon-button" type="button" aria-label="Conversation options">
            ⋯
          </button>
        </div>
      </header>

      <div className="messages" ref={transcriptRef} role="log" aria-live="polite" aria-relevant="additions">
        <div className="date-divider">
          <span>Today</span>
        </div>
        {chat.messages.map((message) => (
          <div className={`bubble-row${message.author === 'me' ? ' outgoing' : ''}`} key={message.id}>
            <div className="bubble">
              {message.replyTo ? <div className="reply-card">{message.replyTo}</div> : null}
              {message.text}
            </div>
            <span className="message-time">
              {message.time}
              {message.status === 'read' ? ' ✓✓' : message.status === 'delivered' ? ' ✓' : ''}
            </span>
          </div>
        ))}
      </div>

      <Composer />
    </section>
  );
}
