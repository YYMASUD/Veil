/**
 * Demo conversation data for the Phase 0 shell. Phase 1 replaces this with
 * real state via @veil/storage + a mocked MessageTransport; the shape of
 * ChatSummary/ChatMessage mirrors what storage returns.
 */

import type { ConversationId } from '@veil/core';

export interface DemoMessage {
  readonly id: string;
  readonly author: 'me' | 'them';
  readonly text: string;
  readonly time: string;
  readonly status?: 'sent' | 'delivered' | 'read';
  readonly replyTo?: string;
}

export interface DemoChat {
  readonly id: ConversationId;
  readonly name: string;
  readonly avatarClass: string;
  readonly initials: string;
  readonly lastMessage: string;
  readonly lastTime: string;
  readonly unread: number;
  readonly messages: readonly DemoMessage[];
  readonly verified: boolean;
}

export const DEMO_CHATS: readonly DemoChat[] = [
  {
    id: 'demo-alice',
    name: 'Alice Voss',
    avatarClass: '',
    initials: 'AV',
    lastMessage: 'Keys rotate at midnight, right?',
    lastTime: '09:42',
    unread: 2,
    verified: true,
    messages: [
      { id: 'm1', author: 'them', text: 'Did the relay come back up?', time: '09:38' },
      { id: 'm2', author: 'me', text: 'Yes — mailbox drained right after.', time: '09:39', status: 'read' },
      { id: 'm3', author: 'them', text: 'Perfect. I will send the bundle tonight.', time: '09:41' },
      { id: 'm4', author: 'them', text: 'Keys rotate at midnight, right?', time: '09:42' },
    ],
  },
  {
    id: 'demo-sacha',
    name: 'Sacha M.',
    avatarClass: 'violet',
    initials: 'SM',
    lastMessage: 'Thanks — that worked perfectly!',
    lastTime: 'Yesterday',
    unread: 0,
    verified: false,
    messages: [
      {
        id: 'm1',
        author: 'me',
        text: 'I pushed the fix for the hole-punch retry.',
        time: '17:02',
        status: 'read',
      },
      { id: 'm2', author: 'them', text: 'Thanks — that worked perfectly!', time: '17:05' },
    ],
  },
  {
    id: 'demo-circle',
    name: 'Thursday Circle',
    avatarClass: 'gold',
    initials: 'TC',
    lastMessage: 'You: Schedule locked in ✅',
    lastTime: 'Tue',
    unread: 5,
    verified: true,
    messages: [
      { id: 'm1', author: 'them', text: 'New member joined via invite link.', time: '11:12' },
      { id: 'm2', author: 'me', text: 'Schedule locked in ✅', time: '11:15', status: 'delivered' },
    ],
  },
];
