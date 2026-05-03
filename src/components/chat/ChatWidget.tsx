import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessionContext } from '../../context/SessionContext';
import {
  useConversations,
  useCreateConversation,
  useMessages,
  useSendMessage,
} from '../../hooks/useChat';
import FluttershyAvatar from './FluttershyAvatar';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const ChatWidget: React.FC = () => {
  const session = useSessionContext();
  const userId = session?.user.id;

  const { data: conversations } = useConversations(userId);
  const createConv = useCreateConversation(userId);

  // Use the most recent conversation, or null until we create one
  const conversationId = conversations?.[0]?.id ?? null;

  const { data: messages } = useMessages(conversationId);
  const send = useSendMessage(userId);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages / typing
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, send.isPending]);

  if (!session) {
    return (
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FluttershyAvatar size={22} />
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Чат с Флаттершай</h4>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
          Войдите, чтобы поговорить с Флаттершай... если хотите.
        </div>
        <Link to="/login" className="btn btn-primary btn-sm" style={{ width: '100%' }}>Войти</Link>
      </div>
    );
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text || send.isPending) return;

    let cid = conversationId;
    if (!cid) {
      const created = await createConv.mutateAsync(undefined);
      cid = created.id;
    }
    setInput('');
    send.mutate({ conversationId: cid, text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        height: 360,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <FluttershyAvatar size={24} />
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>
          Флаттершай
        </h4>
        <Link to="/chat" style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          открыть →
        </Link>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {(!messages || messages.length === 0) && !send.isPending && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
            Привет... я Флаттершай. Если хочешь, мы можем поболтать о чём угодно.
          </div>
        )}
        {messages?.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {send.isPending && <TypingIndicator />}
        {send.isError && (
          <div style={{ fontSize: 11, color: 'var(--error)', padding: '4px 8px' }}>
            Извини... не получилось ответить. {(send.error as Error)?.message?.slice(0, 80)}
          </div>
        )}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напиши Флаттершай..."
          rows={1}
          disabled={send.isPending}
          style={{
            flex: 1,
            resize: 'none',
            fontSize: 12,
            padding: '6px 8px',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-1)',
            fontFamily: 'inherit',
            minHeight: 28,
            maxHeight: 80,
          }}
        />
        <button
          onClick={handleSend}
          disabled={send.isPending || !input.trim()}
          className="btn btn-primary btn-sm"
          style={{ padding: '4px 10px' }}
        >
          →
        </button>
      </div>
    </div>
  );
};

export default ChatWidget;
