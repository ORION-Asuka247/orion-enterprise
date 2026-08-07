# Phase 5 Acceptance Tests

## Source registry
- [ ] GOV.UK Search source exists
- [ ] GOV.UK Content source exists
- [ ] legislation.gov.uk source exists
- [ ] HSE source exists
- [ ] Trust tier stored for every source
- [ ] Disabled source is not polled

## Source monitoring
- [ ] Source run starts
- [ ] Successful run recorded
- [ ] Failed run records error
- [ ] Consecutive failure count increments
- [ ] Polling interval respected
- [ ] Duplicate search result does not create duplicate document

## Versioning
- [ ] First retrieval creates document v1
- [ ] Same content hash creates no new version
- [ ] Changed content creates v2
- [ ] v2 links to v1
- [ ] Change event links v1 → v2
- [ ] Historical content remains available

## GOV.UK
- [ ] Search connector returns normalized items
- [ ] Content API enriches a discovered GOV.UK URL
- [ ] 404/422/5xx fails safely
- [ ] API failure never marks content unchanged

## legislation.gov.uk
- [ ] Known legislation URL retrieves AKN
- [ ] AKN content hashes consistently
- [ ] Failure is logged without altering existing record

## AI analysis
- [ ] Diff is calculated
- [ ] Analysis contains source citation
- [ ] Confidence is 0–100
- [ ] Effective date may remain null
- [ ] Unclear applicability sets human/legal review
- [ ] AI output cannot insert compliance_rule_versions

## Human review
- [ ] Unverified change cannot be approved
- [ ] Source verification required
- [ ] Applicability verification required
- [ ] Effective-date verification required
- [ ] Review actor and timestamp recorded
- [ ] Rejection retains AI analysis and source versions

## Rule proposal
- [ ] Proposal links to regulatory change
- [ ] Proposal can reference existing rule/version
- [ ] Proposal is separate from live rule version
- [ ] Rejected proposal remains auditable

## Portfolio impact
- [ ] Only approved change can run impact analysis
- [ ] Asset-type match creates impact item
- [ ] Template match finds historical inspections
- [ ] Counts calculate correctly
- [ ] Tenant A cannot view Tenant B impact run
- [ ] Historical inspection is not automatically invalidated

## Failure modes
- [ ] GOV.UK API schema change produces visible connector error
- [ ] Source outage does not erase existing data
- [ ] AI outage leaves change awaiting analysis
- [ ] No AI result is treated as legal approval
