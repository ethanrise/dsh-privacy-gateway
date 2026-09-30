# Security policy

## Threat model

dsh-privacy-gateway reduces accidental disclosure of personal data to the configured LLM through the normal DSH conversation path:

- conversation messages are masked before they are sent to the model and written to the session log;
- spreadsheet files are redacted into a safe copy before the user hands them to AI.

It does not protect against a compromised host, malicious dependencies or other plugins, a malicious DSH installation, values the detectors or word list do not cover, or a user sending raw data through another route. Being listed in a plugin index is not a security review.

## Boundary

- **Model and session log.** Detected values are replaced in `agent/pre-step` (and, if enabled, `tools/post-execute`) before DSH logs or sends them. The model and the log see placeholders only.
- **Local state.** The HMAC secret, the placeholder → original vault and the word list live under `~/.dsh-privacy-gateway/`, written with mode `0600` inside a `0700` directory. They are not sent anywhere by this plugin.
- **Browser.** The DSH web UI on this machine reads originals through the plugin's own routes under `api/privacy-gateway/v1/`, which sit behind DSH's connection authentication like other host routes:
  - `mask/resolve` returns originals for placeholders the page asks about (at most 500 per request);
  - `mask/columns` returns the distinct values of each column of an uploaded CSV/XLSX, for word-list import;
  - `scan` returns per-column classifications and counts, not cell values;
  - `redact` returns the redacted file.

  Anyone who can use your DSH web UI can therefore see the originals, just as they can see your conversations.
- **Files.** Uploaded CSV/XLSX files are parsed in memory, capped at 20 MiB, and not stored, logged or added to the DSH attachment store.
- **Logs.** The plugin does not log original values.

## Reporting

Please report security issues privately (GitHub → Security → Report a vulnerability) before publishing details.
