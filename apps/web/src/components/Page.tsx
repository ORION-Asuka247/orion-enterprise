export default function Page({title,kicker,children}:{title:string,kicker:string,children:React.ReactNode}){
 return <><div className="page-head"><div className="eyebrow">{kicker}</div><h1>{title}</h1></div>{children}</>;
}
