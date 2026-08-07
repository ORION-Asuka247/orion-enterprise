export function buildingHealth(scores:number[]){
 return scores.reduce((a,b)=>a+b,0)/scores.length;
}
