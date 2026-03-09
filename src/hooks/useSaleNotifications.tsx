import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook that listens for confirmed sales (status changed to "successful")
 * and shows browser push notifications + in-app toasts.
 * Handles reconnection when the app comes back from background (mobile).
 */
export function useSaleNotifications(userId: string | undefined) {
  const { toast } = useToast();
  const permissionGranted = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if (!userId) return;

    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        permissionGranted.current = true;
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          permissionGranted.current = perm === "granted";
        });
      }
    }
  }, [userId]);

  const handleTransactionUpdate = useCallback(
    (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const tx = payload.new as {
        id: string;
        customer_email: string;
        amount: number;
        status: string;
        order_bump_accepted: boolean;
        order_bump_amount: number | null;
        currency?: string;
      };

      const oldTx = payload.old as { status?: string };

      // Only notify when status changes TO successful
      if (tx.status !== "successful" || oldTx.status === "successful") {
        return;
      }

      const totalAmount =
        Number(tx.amount) +
        (tx.order_bump_accepted ? Number(tx.order_bump_amount || 0) : 0);

      const isZAR = tx.currency === "ZAR";
      const formattedAmount = isZAR
        ? `R ${totalAmount.toLocaleString("en-ZA")}`
        : `${totalAmount.toLocaleString("pt-MZ")} MZN`;

      const title = "💰 Nova venda realizada!";
      const body = `Você recebeu ${formattedAmount}`;

      // In-app toast
      toast({ title, description: body });

      // Browser / mobile push notification
      if (permissionGranted.current && "Notification" in window) {
        try {
          new Notification(title, {
            body,
            icon: "/icons/cashpay-192.png",
            badge: "/icons/cashpay-192.png",
            tag: `sale-${tx.id}`,
          });
        } catch {
          // Fallback: some mobile browsers don't support new Notification()
        }
      }
    },
    [toast]
  );

  // Subscribe to realtime transaction UPDATES
  const subscribe = useCallback(() => {
    // Remove old channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel("sale-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
        },
        handleTransactionUpdate
      )
      .subscribe((status) => {
        console.log("[SaleNotifications] Channel status:", status);
      });

    channelRef.current = channel;
  }, [handleTransactionUpdate]);

  useEffect(() => {
    if (!userId) return;

    subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, subscribe]);

  // Reconnect realtime when app comes back to foreground (critical for mobile)
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[SaleNotifications] App resumed — reconnecting realtime");
        subscribe();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [userId, subscribe]);
}
