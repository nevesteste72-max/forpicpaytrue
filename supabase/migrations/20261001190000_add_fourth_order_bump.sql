-- Quarto order bump.
--
-- O produto principal tinha os tres lugares ocupados e nao havia onde pos
-- mais uma oferta. Estas colunas seguem exactamente o padrao das tres
-- anteriores, para o checkout as poder tratar como uma lista.
alter table payment_links
  add column if not exists order_bump_4_name text,
  add column if not exists order_bump_4_description text,
  add column if not exists order_bump_4_price numeric,
  add column if not exists order_bump_4_image_url text,
  add column if not exists order_bump_4_product_id uuid,
  add column if not exists order_bump_4_kind text;

-- A restricao so conhecia ate ao bump3 e recusava a entrega do quarto.
-- Continua a travar valores inventados.
alter table product_deliverables
  drop constraint if exists product_deliverables_applies_to_check;

alter table product_deliverables
  add constraint product_deliverables_applies_to_check
  check (applies_to = any (array['main','bump1','bump2','bump3','bump4']));
