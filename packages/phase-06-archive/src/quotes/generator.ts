export function total(items:{qty:number,rate:number}[]){
 return items.reduce((a,i)=>a+i.qty*i.rate,0);
}
