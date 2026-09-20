export const deliveryEvents:Record<string,string>={
 'email.sent':'accepted','email.delivered':'delivered','email.delivery_delayed':'deferred','email.bounced':'bounced','email.complained':'complained','email.failed':'failed','email.suppressed':'suppressed'
};
export function deliveryState(type:string){return deliveryEvents[type]||null;}
