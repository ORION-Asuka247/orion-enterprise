export function canView(role:string,resource:string){
 const permissions={
  administrator:["*"],
  manager:["dashboard","documents","approvals","messages"],
  client:["dashboard","documents","approvals","messages"],
  contractor:["workorders","documents","messages"],
  resident:["defects","messages"]
 };
 const p=(permissions as any)[role]||[];
 return p.includes("*")||p.includes(resource);
}
