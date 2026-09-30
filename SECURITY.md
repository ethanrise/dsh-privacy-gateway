# Security policy

## Threat model

dsh-privacy-gateway protects against accidental disclosure of selected raw tabular fields to the configured LLM through the normal DSH conversation path.

It does not protect against a compromised host, malicious dependencies, a malicious DSH installation, or a user explicitly sending the raw file through another route.

## Invariants

- Raw file bytes never enter the DSH attachment store through this plugin.
- Raw values are not logged.
- Scan responses contain counts and classifications, not source cell values.
- HMAC token material remains local.
- Only CSV/XLSX are accepted in v0.1.
- Input size is capped at 20 MiB.

Please report security issues privately before publishing exploit details.
