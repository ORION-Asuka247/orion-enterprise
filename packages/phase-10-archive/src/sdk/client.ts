export class OrionClient{
 constructor(public apiKey:string){}
 async ping(){
  return {status:"ok"};
 }
}
