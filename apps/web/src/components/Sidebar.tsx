import { useVeilStore } from '../store';

/** Searchable conversation list. */
export function Sidebar() {
  const chats = useVeilStore((s) => s.chats);
  const activeChatId = useVeilStore((s) => s.activeChatId);
  const selectChat = useVeilStore((s) => s.selectChat);
  return (
    <aside className="sidebar" aria-label="Conversations">
      <header className="sidebar-head">
        <div>
          <p className="eyebrow">Your private space</p>
          <h1>Messages</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Start a new conversation">
          ＋
        </button>
      </header>
      <div className="search-wrap">
        <label className="sr-only" htmlFor="chat-search">
          Search conversations
        </label>
        <input id="chat-search" className="search" placeholder="Search conversations" />
      </div>
      <div className="section-label">Recent</div>
      <div className="chat-list" role="list">
        {chats.map((chat) => (
          <button
            className={`chat-row${chat.id === activeChatId ? ' active' : ''}`}
            key={chat.id}
            onClick={() => selectChat(chat.id)}
            type="button"
            aria-current={chat.id === activeChatId ? 'page' : undefined}
          >
            <span className={`avatar ${chat.avatarClass}`} aria-hidden="true">
              {chat.initials}
            </span>
            <span className="chat-copy">
              <strong>
                {chat.name}
                {chat.verified ? ' ✓' : ''}
              </strong>
              <span>{chat.lastMessage}</span>
            </span>
            <span className="chat-meta">
              {chat.lastTime}
              {chat.unread > 0 ? (
                <span className="unread" aria-label={`${chat.unread} unread messages`}>
                  {chat.unread}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      <footer className="sidebar-foot">
        <div className="identity-card">
          <span className="avatar" aria-hidden="true">
            M
          </span>
          <span className="identity-info">
            <strong>My identity</strong>
            <span>did:key:z6Mk…a2doK</span>
          </span>
        </div>
        <div className="connection-pill">
          <span className="status-dot" aria-hidden="true" /> Connected peer-to-peer
        </div>
      </footer>
    </aside>
  );
}
