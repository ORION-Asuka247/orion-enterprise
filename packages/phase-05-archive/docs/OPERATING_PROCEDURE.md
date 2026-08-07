# Phase 5 Operating Procedure

## Daily automated activity

1. Identify due sources.
2. Fetch only approved source endpoints.
3. Normalise publications.
4. Calculate SHA-256 content hash.
5. Store new immutable version only when content changed.
6. Create regulatory change event.
7. Queue AI advisory analysis.
8. Present significant results for human review.

## Human review screen should show

- official source
- canonical URL
- publication title
- publication/update dates
- previous version
- new version
- machine diff
- AI summary
- confidence
- proposed affected ORION domains
- proposed effective date
- source citation
- source/applicability/effective-date verification checkboxes
- approve / reject / request changes / defer

## After approval

ORION may:
- generate a rule-change proposal
- run portfolio impact analysis
- notify internal compliance administrators

ORION must not automatically:
- change a live inspection rule
- invalidate historical certificates
- tell customers they are non-compliant solely because AI detected text changes

## Escalation

Critical/high-urgency results should receive accelerated human review.

Repeated connector failures should create an operational alert because regulatory monitoring is itself a controlled service.
