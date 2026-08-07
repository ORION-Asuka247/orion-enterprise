# Phase 4 Acceptance Tests

## Document numbering
- [ ] Number sequence is unique per tenant, type and year
- [ ] Concurrent requests do not create duplicates
- [ ] Inspection report prefix = IR
- [ ] FRAEW prefix = FR
- [ ] Certificate prefix = CERT

## Report snapshots
- [ ] Snapshot contains property
- [ ] Snapshot contains asset
- [ ] Snapshot contains exact template version
- [ ] Snapshot contains answers
- [ ] Snapshot contains defects
- [ ] Snapshot contains evidence references
- [ ] Snapshot contains rule snapshot
- [ ] Tenant cannot snapshot another company's inspection

## PDF generation
- [ ] Inspection PDF renders
- [ ] FRAEW PDF renders
- [ ] Certificate PDF renders
- [ ] Long tables paginate cleanly
- [ ] No clipped headings
- [ ] No overlapping footer
- [ ] Pass/fail status remains legible in grayscale
- [ ] Special characters render correctly

## Versioning
- [ ] Version 1 stored
- [ ] SHA-256 stored
- [ ] Regeneration as v2 does not overwrite v1
- [ ] v2 points to v1 through supersedes_version_id
- [ ] Current version increments correctly
- [ ] Duplicate hash cannot silently create same version twice

## Security
- [ ] generated-documents bucket is private
- [ ] Tenant A cannot fetch Tenant B PDF
- [ ] Frontend contains no service-role key
- [ ] Report generation requires report.generate permission

## Audit
- [ ] Document creation audited
- [ ] Version registration audited
- [ ] Issue/supersede state change audited

## Data integrity
- [ ] PDF hash matches downloaded bytes
- [ ] Stored snapshot remains unchanged after later inspection/template changes
