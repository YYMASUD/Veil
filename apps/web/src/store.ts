import { create } from 'zustand';

import type { DemoChat } from './demoData';
import { DEMO_CHATS } from './demoData';

interface VeilState {
  readonly chats: readonly DemoChat[];
  activeChatId: string;
  draft: string;
  selectChat: (id: string) => void;
  setDraft: (text: string) => void;
  sendMessage: () => void;
}

/**
 * UI-only store (Phase 0). sendMessage appends locally with status "sent";
 * Phase 1 swaps this for crypto+transport calls behind the same interface.
 */
export const useVeilStore = create<VeilState>((set, get) => ({
  chats: DEMO_CHATS,
  activeChatId: DEMO_CHATS[0]!.id,
  draft: '',
  selectChat: (id) => set({ activeChatId: id }),
  setDraft: (text) => set({ draft: text }),
  sendMessage: () => {
    const { activeChatId, chats, draft } = get();
    const text = draft.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    set({
      draft: '',
      chats: chats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              lastMessage: `You: ${text}`,
              lastTime: time,
              messages: [
                ...chat.messages,
                { id: `local-${Date.now()}`, author: 'me', text, time, status: 'sent' as const },
              ],
            }
          : chat,
      ),
    });
  },
}));
