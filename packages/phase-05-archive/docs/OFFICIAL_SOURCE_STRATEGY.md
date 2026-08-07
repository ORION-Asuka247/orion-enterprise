# Official Source Strategy

## GOV.UK

Use Search API for discovery, then Content API for page-level structured content where available.

The connector must:
- rate-limit
- use retry/backoff
- record failures
- deduplicate by canonical URL
- hash content
- preserve retrieved versions

Do not assume the Search API will remain unchanged forever.

## legislation.gov.uk

Prefer structured machine-readable content.

For known legislation URLs, the Phase 5 adapter supports Akoma Ntoso retrieval through `/data.akn`.

Discovery should be constrained to relevant legislation identifiers/topics rather than crawling the entire site.

## HSE

Treat HSE as Tier 2 official regulator guidance.

Production should define a controlled list of:
- relevant guidance pages
- news/update sources
- publications

Do not scrape broadly without respecting published access/robots policies.

## Standards

British Standards or other licensed standards must only be stored/processed to the extent permitted by the applicable licence.

ORION should usually store:
- standard identifier
- version
- licensed clause reference
- interpretation notes

rather than redistributing protected full standards text.
