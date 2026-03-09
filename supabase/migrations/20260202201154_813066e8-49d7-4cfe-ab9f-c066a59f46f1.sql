-- Create profiles table for merchants
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create payment_links table
CREATE TABLE public.payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_description TEXT,
  logo_url TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payment_links
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- Payment links policies - owners can manage, anyone can view active links
CREATE POLICY "Anyone can view active payment links" 
  ON public.payment_links FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Users can view their own links" 
  ON public.payment_links FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create payment links" 
  ON public.payment_links FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own links" 
  ON public.payment_links FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own links" 
  ON public.payment_links FOR DELETE 
  USING (auth.uid() = user_id);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_link_id UUID NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'successful', 'failed')),
  debito_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions policies
CREATE POLICY "Anyone can insert transactions for active links" 
  ON public.transactions FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payment_links 
      WHERE id = payment_link_id AND is_active = true
    )
  );

CREATE POLICY "Link owners can view their transactions" 
  ON public.transactions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.payment_links 
      WHERE id = payment_link_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Link owners can update their transactions" 
  ON public.transactions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.payment_links 
      WHERE id = payment_link_id AND user_id = auth.uid()
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, business_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_payment_links_user_id ON public.payment_links(user_id);
CREATE INDEX idx_payment_links_is_active ON public.payment_links(is_active);
CREATE INDEX idx_transactions_payment_link_id ON public.transactions(payment_link_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);