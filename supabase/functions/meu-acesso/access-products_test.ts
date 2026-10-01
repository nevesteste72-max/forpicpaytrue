import { resolveDeliverablePaymentLinkId } from "./access-products.ts";

Deno.test("uses the configured product checkout for a flow-step purchase", () => {
  const configured = new Map([
    ["step-1", "product-checkout-1"],
  ]);
  const result = resolveDeliverablePaymentLinkId({
    payment_link_id: "main-checkout",
    flow_step_id: "step-1",
  }, configured);

  if (result !== "product-checkout-1") {
    throw new Error(`Expected configured upsell product, got ${result}`);
  }
});

Deno.test("recovers the +170 upsell for an existing transaction", () => {
  const configuredSteps = new Map([
    ["e1700000-0000-4000-8000-000000000003", "d1700000-0000-4000-8000-000000000f17"],
  ]);
  const result = resolveDeliverablePaymentLinkId({
    payment_link_id: "d1700000-0000-4000-8000-000000000790",
    flow_step_id: "e1700000-0000-4000-8000-000000000003",
  }, configuredSteps);

  if (result !== "d1700000-0000-4000-8000-000000000f17") {
    throw new Error(`Expected the 150 Receitas product, got ${result}`);
  }
});

Deno.test("keeps direct one-click purchases attached to their own product", () => {
  const result = resolveDeliverablePaymentLinkId({
    payment_link_id: "upsell-checkout",
  }, new Map());

  if (result !== "upsell-checkout") {
    throw new Error(`Expected direct product link, got ${result}`);
  }
});

Deno.test("does not grant the base product for an unmapped flow step", () => {
  const result = resolveDeliverablePaymentLinkId({
    payment_link_id: "main-checkout",
    flow_step_id: "unknown-step",
  }, new Map());

  if (result !== null) {
    throw new Error(`Expected an unresolved flow step, got ${result}`);
  }
});
