import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
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

export const useConversations = (userId: string | undefined) =>
  useQuery({
    queryKey: ['chat-conversations', userId],
    enabled: !!userId,
    queryFn: api.listConversations,
  });

export const useMessages = (conversationId: string | null | undefined) =>
  useQuery({
    queryKey: ['chat-messages', conversationId],
    enabled: !!conversationId,
    queryFn: () => api.listMessages(conversationId!),
  });

export const useCreateConversation = (userId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      if (!userId) throw new Error('Not signed in');
      return api.createConversation(title);
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
      await api.deleteConversation(id);
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
      const history = await api.listMessages(conversationId);

      const turns: ChatTurn[] = (history ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      turns.push({ role: 'user', content: text });

      // 2. Insert user message
      await api.createMessage(conversationId, 'user', text);

      // Optimistically refresh so user sees their message immediately
      qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] });

      // 3. Call OpenRouter
      const reply = await fluttershyReply(turns);

      // 4. Insert assistant reply
      await api.createMessage(conversationId, 'assistant', reply);

      return reply;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['chat-messages', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations', userId] });
    },
  });
};
