export type UUID = string;
export type RiskLevel="low"|"medium"|"high"|"critical";
export type Outcome="pass"|"fail"|"conditional"|"pending"|"not_applicable";
export interface TenantScoped { company_id: UUID; }
