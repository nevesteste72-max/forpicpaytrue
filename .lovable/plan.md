# Checkout de Doação

## Visão geral

Adicionar um modo "doação" ao sistema de produtos. Quando ativado em um produto, a página `/pay/:linkId` renderiza um **layout diferente** otimizado para doações, em vez do checkout normal de venda.

Layout escolhido: **split-screen** (história/imagem/vídeo à esquerda, formulário de doação à direita). É o formato com maior conversão para campanhas — GoFundMe, Kickstarter e Patreon usam variações disso.

## O que muda no painel

No `CreateProductDialog` e `EditProductDialog`, adicionar uma nova seção **"Modo Doação"** com:

- Toggle **"É uma campanha de doação?"** (quando ligado, esconde Order Bumps, Recovery, Redirect — não fazem sentido aqui)
- **Valores fixos** (lista editável: ex. 100, 250, 500, 1000) — doador escolhe um botão
- **Meta da campanha** (opcional): valor objetivo + toggle "mostrar barra de progresso"
- **Bloco história** (tudo opcional, tudo personalizável):
  - Título grande (headline)
  - Texto descritivo (textarea longa)
  - Upload de imagem da causa
  - URL de vídeo (YouTube/Vimeo embed)
- **Texto do botão de doar** (default: "Doar agora")
- **Permitir doação anônima** (toggle — mostra checkbox no checkout)

## O que muda na página de checkout

Em `/pay/:linkId`, detectar `is_donation`:
- **Se `false`** → checkout atual, sem alterações
- **Se `true`** → renderiza `<DonationCheckout />`

### Estrutura do DonationCheckout

```text
+--------------------------------------------+----------------------+
|  [imagem grande da causa]                  |  Título: "Doe agora" |
|                                            |  Meta: ████░░ 65%    |
|  Título da campanha                        |  R$ 6.500 de R$10mil |
|                                            |                      |
|  Texto da história (markdown simples)      |  Escolha o valor:    |
|                                            |  [100] [250] [500]   |
|  [vídeo embed se houver]                   |  [1000]              |
|                                            |                      |
|  Trust badges                              |  Nome / Email        |
|                                            |  ☐ Doar anonimamente |
|                                            |  [Doar R$ 250]       |
+--------------------------------------------+----------------------+
```

A barra de meta é calculada em tempo real: soma de `transactions` com `status='approved'` para esse `payment_link_id` ÷ `donation_goal_amount`.

Reaproveita 100% do motor de pagamento atual (M-Pesa/eMola para MZN, Stripe para ZAR/USD/NGN). Só muda a UI ao redor.

## Detalhes técnicos

### Migration (`payment_links`)
```sql
alter table payment_links add column
  is_donation boolean not null default false,
  donation_amounts numeric[] not null default '{}',
  donation_goal_amount numeric,
  donation_goal_enabled boolean not null default false,
  donation_story_title text,
  donation_story_text text,
  donation_story_image_url text,
  donation_story_video_url text,
  donation_cta_text text,
  donation_allow_anonymous boolean not null default false;
```

### Migration (`transactions`)
```sql
alter table transactions add column
  is_anonymous boolean not null default false;
```

### Arquivos
- **Novo:** `src/components/checkout/DonationCheckout.tsx` — componente da nova página
- **Editar:** `src/pages/Checkout.tsx` — `if (link.is_donation) return <DonationCheckout link={link} />`
- **Editar:** `src/components/dashboard/CreateProductDialog.tsx` — seção doação + repassar campos
- **Editar:** `src/components/dashboard/EditProductDialog.tsx` — idem
- **Editar:** `src/pages/Dashboard.tsx` (ou onde o `onCreate` insere no banco) — passar novos campos no insert/update
- **Editar:** `src/components/dashboard/ProductGrid.tsx` — badge "Doação" no card

### Reaproveitamento
- Email de confirmação, UTMify, Facebook Pixel e webhooks Stripe continuam funcionando idênticos (a transação é gravada do mesmo jeito, só com `is_anonymous=true` quando for o caso).
- M-Pesa/eMola/Stripe: mesma `create-stripe-payment` / `debito-payment` — apenas o `amount` vem do botão selecionado.

## Fora do escopo (posso fazer depois se quiser)
- Contador de doadores ao vivo
- Feed "Maria doou R$ 100 há 2min"
- Mensagem opcional do doador
- Compartilhamento social da campanha

Confirma que devo seguir esse plano?
