-- Backfill checkout_banner_url from files already present in the payment-images bucket
UPDATE public.payment_links pl
SET checkout_banner_url = 'https://qnnygkzapkruxekjkpse.supabase.co/storage/v1/object/public/payment-images/' || o.name
FROM storage.objects o
WHERE o.bucket_id = 'payment-images'
  AND pl.checkout_banner_url IS NULL
  AND (
    o.name = pl.user_id::text || '/' || pl.id::text || '-banner.png'
    OR o.name = pl.user_id::text || '/' || pl.id::text || '-banner.jpg'
    OR o.name = pl.user_id::text || '/' || pl.id::text || '-banner.jpeg'
    OR o.name = pl.user_id::text || '/' || pl.id::text || '-banner.webp'
    OR o.name = pl.user_id::text || '/' || pl.id::text || '-banner.gif'
    OR o.name = pl.user_id::text || '/' || pl.id::text || '-banner.svg'
  );