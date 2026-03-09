
-- Add message templates for each transaction event
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS msg_template_approved text DEFAULT 'Olá {name}! ✅ Sua compra de {product} no valor de {currency} {amount} foi confirmada com sucesso! Obrigado pela sua compra.',
  ADD COLUMN IF NOT EXISTS msg_template_pending text DEFAULT 'Olá {name}! ⏳ Notamos que sua compra de {product} no valor de {currency} {amount} está pendente. Precisa de ajuda para completar o pagamento?',
  ADD COLUMN IF NOT EXISTS msg_template_failed text DEFAULT 'Olá {name}! ❌ Infelizmente sua compra de {product} no valor de {currency} {amount} não foi processada. Gostaria de tentar novamente? Estamos aqui para ajudar!';
