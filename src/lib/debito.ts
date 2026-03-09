export type PaymentMethod = "mpesa" | "emola" | "card";

export interface PaymentRequest {
  method: PaymentMethod;
  amount: number;
  msisdn?: string;
  reference_description: string;
  // Transaction data for edge function
  payment_link_id?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  order_bump_accepted?: boolean;
  order_bump_amount?: number;
  // Card fields
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  callback_url?: string;
}

export interface PaymentResponse {
  success: boolean;
  message?: string;
  debito_reference?: string;
  status?: string;
  transaction_id?: number;
  internal_transaction_id?: string;
  redirect_url?: string;
  error?: string;
  details?: unknown;
}

export interface TransactionStatus {
  success: boolean;
  status?: string;
  debito_status?: string;
  message?: string;
  error?: string;
}

export async function initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/debito-payment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      }
    );

    const text = await response.text();
    try {
      return JSON.parse(text) as PaymentResponse;
    } catch {
      console.error("Payment function returned non-JSON:", text);
      return {
        success: false,
        error: "Resposta inválida do servidor de pagamentos.",
        details: { raw_response: text.slice(0, 200) },
      };
    }
  } catch (err: unknown) {
    const isAbort =
      err instanceof DOMException
        ? err.name === "AbortError"
        : (err as { name?: string } | null)?.name === "AbortError";

    if (isAbort) {
      return {
        success: false,
        error: "Tempo limite ao iniciar o pagamento. Tente novamente.",
      };
    }

    console.error("Payment error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkTransactionStatus(
  reference: string,
  transactionId?: string | null,
  trackingParams?: Record<string, string | null>
): Promise<TransactionStatus> {
  const params = new URLSearchParams({ reference });
  if (transactionId) params.append("transaction_id", transactionId);
  if (trackingParams) {
    params.append("tracking_params", JSON.stringify(trackingParams));
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/debito-status?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();
  return result as TransactionStatus;
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("258")) {
    return digits.slice(3);
  }
  return digits;
}

export function validateMoçambiquePhone(phone: string): boolean {
  const digits = formatPhoneNumber(phone);
  return /^8[4-7]\d{7}$/.test(digits);
}

export function getPaymentMethodInfo(method: PaymentMethod) {
  const methods = {
    mpesa: {
      name: "M-Pesa",
      description: "Vodacom M-Pesa",
      icon: "phone",
      color: "mpesa",
      prefix: "84",
    },
    emola: {
      name: "eMola",
      description: "Movitel eMola",
      icon: "wallet",
      color: "emola",
      prefix: "84",
    },
    card: {
      name: "Cartão",
      description: "Visa / Mastercard",
      icon: "credit-card",
      color: "card-payment",
      prefix: null,
    },
  };

  return methods[method];
}
