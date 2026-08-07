export function exportInvoicePayload(workOrderRef:string){
 return {workOrderRef,status:"ready_for_invoice"};
}
