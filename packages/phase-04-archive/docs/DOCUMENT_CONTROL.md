# Controlled Document Standard

Every issued ORION document should show:

- organisation
- document title
- controlled document number
- version/revision
- issue date
- property/site
- asset reference where applicable
- inspection/reference number where applicable
- author/generator
- approval/issuer where applicable
- confidentiality notice
- copyright notice

## Version rules

Never overwrite an issued document binary.

Correction:
- create new version
- explain reason
- preserve previous version
- mark previous version superseded when appropriate

Withdrawal:
- retain the document and audit history
- change status to withdrawn
- do not physically delete ordinary issued records through the UI

## Hash

SHA-256 provides a practical integrity fingerprint for each generated binary.

The application should verify hashes when a document is downloaded for high-assurance workflows.
