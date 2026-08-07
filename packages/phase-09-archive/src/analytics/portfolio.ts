export function portfolioRisk(scores:number[]){
 const avg=scores.reduce((a,b)=>a+b,0)/Math.max(scores.length,1);
 return {
  averageRisk:avg,
  status:avg>80?"Critical":avg>60?"High":avg>35?"Medium":"Low"
 };
}
