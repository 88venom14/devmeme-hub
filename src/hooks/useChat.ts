import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fluttershyReply, type ChatTurn } from '../lib/chat';

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const HISTORY_LIMIT = 30;

export const useConversations = (userId: string | undefined) =>
  useQuery({
    queryKey: ['chat-conversations', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatConversation[];
    },
  });

export const useMessages = (conversationId: string | null | undefined) =>
  useQuery({
    queryKey: ['chat-messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
        .limit(HISTORY_LIMIT);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

export const useCreateConversation = (userId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: userId, title: title ?? 'Новый чат' })
        .select()
        .single();
      if (error) throw error;
      return data as ChatConversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-conversations', userId] });
    },
  });
};

export const useDeleteConversation = (userId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-conversations', userId] });
    },
  });
};

export const useSendMessage = (userId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, text }: { conversationId: string; text: string }) => {
      if (!conversationId) throw new Error('No conversation');
      if (!userId) throw new Error('Not signed in');

      // 1. Read existing history
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(HISTORY_LIMIT);

      const turns: ChatTurn[] = (history ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      turns.push({ role: 'user', content: text });

      // 2. Insert user message
      const { error: insertErr } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: text,
      });
      if (insertErr) throw insertErr;

      // Optimistically refresh so user sees their message immediately
      qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] });

      // 3. Call OpenRouter
      const reply = await fluttershyReply(turns);

      // 4. Insert assistant reply
      const { error: replyErr } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: reply,
      });
      if (replyErr) throw replyErr;

      // 5. Bump conversation updated_at + autotitle on first message
      const isFirst = (history?.length ?? 0) === 0;
      const patch: Record<string, string> = { updated_at: new Date().toISOString() };
      if (isFirst) patch.title = text.slice(0, 50);
      await supabase.from('chat_conversations').update(patch).eq('id', conversationId);

      return reply;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['chat-messages', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations', userId] });
    },
  });
};
