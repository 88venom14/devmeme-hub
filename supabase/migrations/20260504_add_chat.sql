-- AI chat: conversations + messages, scoped to user
CREATE TABLE public.chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Новый чат',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_conversations_user_id ON public.chat_conversations(user_id, updated_at DESC);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can create own conversations" ON public.chat_conversations FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can create own messages" ON public.chat_messages FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own messages" ON public.chat_messages FOR DELETE USING ((select auth.uid()) = user_id);
