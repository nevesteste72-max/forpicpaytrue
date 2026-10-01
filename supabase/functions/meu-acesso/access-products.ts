export type AccessTransactionProduct = {
  payment_link_id: string;
  flow_step_id?: string | null;
};

export function resolveDeliverablePaymentLinkId(
  transaction: AccessTransactionProduct,
  checkoutLinkByStepId: ReadonlyMap<string, string>,
): string | null {
  if (!transaction.flow_step_id) return transaction.payment_link_id || null;

  return checkoutLinkByStepId.get(transaction.flow_step_id)
    ?? null;
}
