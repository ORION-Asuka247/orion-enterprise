# Phase 2 Acceptance Tests

## Template tests

- [ ] Create a tenant-owned inspection template
- [ ] Create version 1
- [ ] Add section
- [ ] Add required question
- [ ] Add evidence-required question
- [ ] Approve template version
- [ ] Confirm unauthorised tenant cannot view private template

## Rule tests

- [ ] Create rule
- [ ] Create approved rule version
- [ ] Link rule to question
- [ ] Test equal rule
- [ ] Test numeric greater/less rules
- [ ] Test between rule
- [ ] Test boolean rule
- [ ] Test list membership rule

## Fire Door demonstration test

For TOP_GAP_MM demonstration rule:

- [ ] 2 mm evaluates pass
- [ ] 3 mm evaluates pass
- [ ] 4 mm evaluates pass
- [ ] 1 mm evaluates fail
- [ ] 5 mm evaluates fail
- [ ] failed answer creates defect
- [ ] defect links to exact answer and rule version

## Emergency lighting demonstration test

- [ ] functional=true evaluates pass
- [ ] functional=false evaluates fail
- [ ] false creates high severity defect

## Submission tests

- [ ] missing required answer blocks submission
- [ ] missing required evidence blocks submission
- [ ] complete evidence passes validation

## Version-control tests

- [ ] Create rule version 1
- [ ] Create inspection using version 1
- [ ] Capture rule snapshot
- [ ] Create rule version 2
- [ ] Confirm old inspection snapshot still contains version 1
- [ ] Confirm new inspection can use version 2

## Tenant security

- [ ] Tenant A cannot read Tenant B inspections
- [ ] Tenant A cannot read Tenant B evidence
- [ ] Tenant A cannot read Tenant B defects
- [ ] Cross-tenant asset/property inspection creation rejected

## Audit

- [ ] template edit creates audit row
- [ ] rule edit creates audit row
- [ ] inspection answer creates audit row
- [ ] defect update creates audit row
