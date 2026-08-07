# Phase 3 Acceptance Tests

## Authentication / assignments

- [ ] Engineer signs in
- [ ] Engineer sees own assignments
- [ ] Engineer cannot see another tenant's assignments
- [ ] Manager can create assignment
- [ ] Engineer can mark assigned work in progress

## QR / manual identification

- [ ] Valid QR resolves correct asset
- [ ] Unknown QR returns safe error
- [ ] Camera refusal offers manual search
- [ ] Unsupported BarcodeDetector offers manual search
- [ ] Asset code search works
- [ ] Asset-name search works
- [ ] Property-name search works
- [ ] QR and manual route resolve the same asset ID

## Guided inspection

- [ ] Correct template loads
- [ ] Sections ordered correctly
- [ ] Questions ordered correctly
- [ ] Required questions clearly marked
- [ ] Boolean control works
- [ ] Number field works
- [ ] Text/date/choice fields work
- [ ] Progress can be resumed

## Evidence

- [ ] Camera photograph can be captured
- [ ] Evidence is stored locally offline
- [ ] Evidence uploads when online
- [ ] Evidence object is stored in private bucket
- [ ] Tenant cannot access another company's evidence
- [ ] Evidence record links to inspection/question

## Offline

- [ ] Assigned work cached before loss of signal
- [ ] Inspection opens without signal
- [ ] Answers can be recorded offline
- [ ] Photographs can be recorded offline
- [ ] Queue count is visible
- [ ] Reconnection starts synchronisation
- [ ] Failed sync leaves item queued
- [ ] Repeat sync does not create duplicate answer/evidence rows

## Compliance integration

- [ ] Answer triggers rule evaluation
- [ ] Passing answer records pass
- [ ] Failed answer records fail
- [ ] Failed answer creates one defect
- [ ] Repeated sync does not duplicate open defect
- [ ] Inspection overall outcome recalculates

## Submission

- [ ] Missing required answer blocks submission
- [ ] Missing required evidence blocks submission
- [ ] Successful submission captures rule snapshot
- [ ] Successful submission records submitted_at
- [ ] Assignment becomes completed

## Field usability

- [ ] Usable on current iPhone Safari
- [ ] Usable on current Android Chrome
- [ ] Usable on tablet
- [ ] Controls meet comfortable touch-target size
- [ ] Poor-signal behaviour is understandable to engineer
