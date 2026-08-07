export default function Metric({label,value,sub}:{label:string,value:string,sub?:string}){
 return <div className="metric"><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>;
}
