-- Enable realtime for transactions table to power sale notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;