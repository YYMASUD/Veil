import { beforeEach, describe, expect, it } from 'vitest';

import { useVeilStore } from '../src/store';

describe('conversation store', () => {
  beforeEach(() => {
    useVeilStore.setState({
      activeChatId: 'demo-alice',
      draft: '',
      chats: [
        {
          id: 'demo-alice',
          name: 'Alice',
          avatarClass: '',
          initials: 'A',
          lastMessage: 'hi',
          lastTime: '09:00',
          unread: 0,
          verified: true,
          messages: [],
        },
      ],
    });
  });

  it('ignores empty or whitespace-only drafts', () => {
    const store = useVeilStore.getState();
    store.setDraft('   ');
    store.sendMessage();
    expect(useVeilStore.getState().chats[0]?.messages).toHaveLength(0);
    expect(useVeilStore.getState().draft).toBe('   ');
  });

  it('appends a sent message and clears the draft', () => {
    const store = useVeilStore.getState();
    store.setDraft('  hello veil  ');
    store.sendMessage();
    const state = useVeilStore.getState();
    expect(state.draft).toBe('');
    expect(state.chats[0]?.messages).toHaveLength(1);
    expect(state.chats[0]?.messages[0]).toMatchObject({ author: 'me', text: 'hello veil', status: 'sent' });
    expect(state.chats[0]?.lastMessage).toBe('You: hello veil');
  });

  it('switches the active conversation', () => {
    useVeilStore.getState().selectChat('demo-alice');
    expect(useVeilStore.getState().activeChatId).toBe('demo-alice');
  });
});
