import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, ArrowRight, ShieldCheck, MessageSquare, ClipboardCheck, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Find purchase", icon: ShieldCheck },
  { label: "Refund reason", icon: MessageSquare },
  { label: "Review details", icon: ClipboardCheck },
  { label: "Completed", icon: ThumbsUp },
];

const REASONS = [
  "Product did not meet expectations",
  "Could not access the product",
  "Purchased by mistake",
  "Found a better product",
  "Technical issues",
  "Other reason",
];

interface FoundTransaction {
  id: string;
  customer_email: string;
  customer_name: string;
  amount: number;
  currency: string;
  payment_link_id: string;
  product_name: string;
  created_at: string;
}

export default function RefundRequest() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<FoundTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<FoundTransaction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const searchTransactions = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    const { data, error: err } = await supabase
      .from("transactions")
      .select("id, customer_email, customer_name, amount, currency, payment_link_id, created_at")
      .eq("customer_email", email.trim().toLowerCase())
      .in("status", ["successful", "completed", "success"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (err || !data || data.length === 0) {
      setError("No purchases found with this email. Please check and try again.");
      setLoading(false);
      return;
    }

    const linkIds = [...new Set(data.map((t) => t.payment_link_id))];
    const { data: links } = await supabase
      .from("payment_links")
      .select("id, product_name, user_id")
      .in("id", linkIds);

    const linkMap = new Map(links?.map((l) => [l.id, l]) || []);

    const enriched: FoundTransaction[] = data
      .filter((t) => linkMap.has(t.payment_link_id))
      .map((t) => ({
        ...t,
        product_name: linkMap.get(t.payment_link_id)?.product_name || "Product",
      }));

    if (enriched.length === 0) {
      setError("No purchases found with this email.");
      setLoading(false);
      return;
    }

    setTransactions(enriched);
    setStep(1);
    setLoading(false);
  };

  const submitRefund = async () => {
    if (!selectedTx || !reason) return;
    setLoading(true);

    const { data: link } = await supabase
      .from("payment_links")
      .select("user_id")
      .eq("id", selectedTx.payment_link_id)
      .single();

    if (!link) {
      setError("Error processing request. Please try again.");
      setLoading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("refund_requests").insert({
      transaction_id: selectedTx.id,
      payment_link_id: selectedTx.payment_link_id,
      customer_email: selectedTx.customer_email,
      customer_name: selectedTx.customer_name,
      product_name: selectedTx.product_name,
      amount: selectedTx.amount,
      currency: selectedTx.currency,
      reason,
      reason_details: reasonDetails || null,
      user_id: link.user_id,
    } as any);

    if (insertErr) {
      setError("Error submitting request. Please try again.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setStep(3);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Request a Refund</h1>
          <p className="text-muted-foreground mt-2">
            By doing this, your purchase will be cancelled and you will no longer be able to access the product.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8 md:gap-12">
          {/* Stepper */}
          <div className="flex md:flex-col gap-2 md:gap-0">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === i;
              const isDone = step > i;
              return (
                <div key={i} className="flex items-start gap-3 md:pb-8 relative">
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block absolute left-[13px] top-[28px] w-[2px] h-[calc(100%-16px)] bg-border" />
                  )}
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all z-10",
                      isDone
                        ? "bg-primary border-primary text-primary-foreground"
                        : isActive
                        ? "border-primary bg-background text-primary"
                        : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                    )}
                  >
                    {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium hidden md:block",
                      isActive ? "text-foreground" : isDone ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Content */}
          <div>
            {step === 0 && (
              <Card>
                <CardContent className="p-6 space-y-5">
                  <h2 className="text-xl font-semibold">Enter your purchase email</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the email you used to make the purchase. We will locate your transactions.
                  </p>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchTransactions()}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="flex justify-end">
                    <Button onClick={searchTransactions} disabled={loading || !email.trim()}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Next <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <CardContent className="p-6 space-y-5">
                  <h2 className="text-xl font-semibold">Select the product and reason</h2>

                  {/* Product selection */}
                  <div>
                    <p className="text-sm font-medium mb-2">Product *</p>
                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <button
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all",
                            selectedTx?.id === tx.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">{tx.product_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(tx.created_at).toLocaleDateString("en-US")}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {tx.currency} {tx.amount.toFixed(2)}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reason selection */}
                  <div>
                    <p className="text-sm font-medium mb-2">Refund reason *</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setReason(r)}
                          className={cn(
                            "text-left p-3 rounded-lg border text-sm transition-all",
                            reason === r
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Details */}
                  <div>
                    <p className="text-sm font-medium mb-2">Explain in more detail (optional)</p>
                    <Textarea
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      placeholder="Describe what happened..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                    <Button
                      onClick={() => setStep(2)}
                      disabled={!selectedTx || !reason}
                    >
                      Next <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && selectedTx && (
              <Card>
                <CardContent className="p-6 space-y-5">
                  <h2 className="text-xl font-semibold">Review your information</h2>
                  <p className="text-sm text-muted-foreground">
                    Please review the details below before submitting your refund request.
                  </p>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Product</span>
                      <span className="text-sm font-medium">{selectedTx.product_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Amount</span>
                      <span className="text-sm font-medium">
                        {selectedTx.currency} {selectedTx.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-sm font-medium">{selectedTx.customer_email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Purchase date</span>
                      <span className="text-sm font-medium">
                        {new Date(selectedTx.created_at).toLocaleDateString("en-US")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Reason</span>
                      <span className="text-sm font-medium">{reason}</span>
                    </div>
                    {reasonDetails && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-sm text-muted-foreground">Details:</span>
                        <p className="text-sm mt-1">{reasonDetails}</p>
                      </div>
                    )}
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button onClick={submitRefund} disabled={loading} variant="destructive">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Request Refund
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold">Refund request submitted successfully!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Your refund request has been recorded. The refund will be processed and your bank may take between{" "}
                    <strong>2 to 45 business days</strong> to return the amount to your account.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You will receive a confirmation email at <strong>{email}</strong> once the refund is completed.
                  </p>
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Estimated time: 2 to 45 business days
                  </Badge>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
