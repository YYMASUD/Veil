import { ChatView } from './components/ChatView';
import { NavRail } from './components/NavRail';
import { Sidebar } from './components/Sidebar';

/**
 * Phase 0 shell. Conversation data is local demo state; Phase 1 replaces it
 * with @veil/storage + a mocked MessageTransport behind the same store API.
 */
export function App() {
  return (
    <div className="veil-app">
      <div className="shell">
        <NavRail />
        <Sidebar />
        <ChatView />
      </div>
    </div>
  );
}
