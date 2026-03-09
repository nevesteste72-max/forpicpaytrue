
-- WhatsApp instances table
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL,
  instance_id TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  agent_prompt TEXT DEFAULT 'Você é um assistente de atendimento ao cliente. Seja educado, prestativo e responda em português.',
  auto_delivery_enabled BOOLEAN DEFAULT true,
  auto_recovery_enabled BOOLEAN DEFAULT true,
  auto_support_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instances"
ON public.whatsapp_instances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own instances"
ON public.whatsapp_instances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instances"
ON public.whatsapp_instances FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instances"
ON public.whatsapp_instances FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  remote_jid TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT 'customer',
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  whatsapp_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
ON public.whatsapp_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert messages"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_whatsapp_messages_remote_jid ON public.whatsapp_messages(instance_id, remote_jid, created_at DESC);
