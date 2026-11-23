export const deliveryEvents:Record<string,string>={
 'email.sent':'accepted','email.delivered':'delivered','email.delivery_delayed':'deferred','email.bounced':'bounced','email.complained':'complained','email.failed':'failed','email.suppressed':'suppressed'
};
export function deliveryState(type:string){return deliveryEvents[type]||null;}

const receiptLabels: Record<string,string> = {
  accepted: "Accepted by Resend", delivered: "Delivered to mail server", deferred: "Delivery delayed",
  bounced: "Bounced", complained: "Spam complaint received", failed: "Delivery failed", suppressed: "Delivery suppressed",
};

export function deliveryHistoryLabel(kind: string, queueStatus: string, providerStatus?: string | null) {
  if (kind !== "email") return queueStatus;
  if (providerStatus && receiptLabels[providerStatus]) return receiptLabels[providerStatus];
  return queueStatus === "sent" ? receiptLabels.accepted : queueStatus;
}
