import React, { useEffect, useRef, useState } from 'react';
import { useSessionContext } from '../context/SessionContext';
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useMessages,
  useSendMessage,
} from '../hooks/useChat';
import FluttershyAvatar from '../components/chat/FluttershyAvatar';
import MessageBubble from '../components/chat/MessageBubble';
import TypingIndicator from '../components/chat/TypingIndicator';

const ChatPage: React.FC = () => {
  const session = useSessionContext();
  const userId = session?.user.id;

  const { data: conversations, isLoading: loadingConvs } = useConversations(userId);
  const createConv = useCreateConversation(userId);
  const deleteConv = useDeleteConversation(userId);

  const [activeId, setActiveId] = useState<string | null>(null);
  // Mobile view: 'list' shows conversation list full-screen, 'chat' shows active chat.
  // Defaults to 'list' on phones so users can pick a chat first; ignored on desktop (CSS shows both).
  const [mobileView, setMobileView] = useState<'list' | 'chat'>(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768 ? 'list' : 'chat'
  );

  // On desktop only, auto-select most recent conversation
  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
    if (isDesktop && !activeId && conversations && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const { data: messages } = useMessages(activeId);
  const send = useSendMessage(userId);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, send.isPending]);

  if (!session) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>
        Войдите, чтобы пользоваться чатом.
      </div>
    );
  }

  const handleNewChat = async () => {
    const created = await createConv.mutateAsync(undefined);
    setActiveId(created.id);
    setMobileView('chat');
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string) => {
    await deleteConv.mutateAsync(id);
    if (activeId === id) setActiveId(null);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    setMobileView('chat');
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || send.isPending) return;
    let cid = activeId;
    if (!cid) {
      const created = await createConv.mutateAsync(undefined);
      cid = created.id;
      setActiveId(cid);
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
    <div className={`chat-page chat-mobile-${mobileView}`}>
      {/* Conversation list */}
      <aside className="chat-conv-list">
        <button
          onClick={handleNewChat}
          className="btn btn-primary btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          + Новый чат
        </button>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loadingConvs && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Загрузка...</div>}
          {conversations?.map((c) => {
            const active = c.id === activeId;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(c.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(c.id); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 8px',
                  borderRadius: 6,
                  background: active ? 'var(--bg-2)' : 'transparent',
                  color: active ? 'var(--text-1)' : 'var(--text-2)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
              >
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                  style={{
                    background: 'none', border: 'none', padding: 2,
                    color: 'var(--text-3)', cursor: 'pointer', fontSize: 14,
                    opacity: 0.6,
                  }}
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            );
          })}
          {!loadingConvs && conversations && conversations.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 8 }}>
              Нет чатов. Создай первый!
            </div>
          )}
        </div>
      </aside>

      {/* Active chat */}
      <section className="chat-active">
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderBottom: '1px solid var(--border)',
        }}>
          <button
            type="button"
            className="chat-mobile-toggle"
            onClick={() => setMobileView('list')}
            aria-label="Все чаты"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            Чаты
          </button>
          <FluttershyAvatar size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Флаттершай</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              добрая, нежная, всегда рада поговорить
            </div>
          </div>
        </header>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {(!messages || messages.length === 0) && !send.isPending && (
            <div style={{
              margin: 'auto', textAlign: 'center', color: 'var(--text-3)',
              fontSize: 13, lineHeight: 1.6, maxWidth: 320, padding: 16,
            }}>
              Привет... я Флаттершай.<br />
              Если хочешь, мы можем поговорить о чём угодно — о коде, о жизни, или просто помолчать вместе.
            </div>
          )}
          {messages?.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {send.isPending && <TypingIndicator />}
          {send.isError && (
            <div style={{ fontSize: 12, color: 'var(--error)', padding: 8 }}>
              Извини... что-то пошло не так. {(send.error as Error)?.message?.slice(0, 200)}
            </div>
          )}
        </div>

        <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напиши сообщение..."
            rows={1}
            disabled={send.isPending}
            style={{
              flex: 1,
              resize: 'none',
              fontSize: 13,
              padding: '9px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-1)',
              fontFamily: 'inherit',
              minHeight: 38,
              maxHeight: 140,
              lineHeight: 1.4,
            }}
          />
          <button
            onClick={handleSend}
            disabled={send.isPending || !input.trim()}
            className="btn btn-primary"
            style={{ alignSelf: 'stretch', padding: '0 14px', flexShrink: 0 }}
          >
            {send.isPending ? '...' : '→'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ChatPage;
