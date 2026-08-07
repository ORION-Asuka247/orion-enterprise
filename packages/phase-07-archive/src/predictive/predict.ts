export function simpleRisk(defects:number,repairs:number){
 const score=Math.min(100,(defects*12)+(repairs*8));
 return {
   risk:score,
   level:score>80?"critical":score>50?"high":score>25?"medium":"low"
 };
}
