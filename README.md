# dsh-privacy-gateway

Local-first privacy gateway for DeepSeek Harness.

The problem this project targets is simple:

> I want AI to analyze enterprise data, but I do not want raw customer identities and contact information to reach the model.

## Security boundary

The raw file is sent only to the local DSH Host endpoint owned by this plugin. It is parsed in memory and is **not**:

- added to the DSH attachment store;
- inserted into the conversation;
- returned in a tool result;
- written to plugin logs;
- uploaded to a remote LLM by this plugin.

Only the redacted safe copy is intended to be handed to AI.

This is a privacy boundary, not a claim that the whole machine is trusted or compromise-proof.

## v0.1 scope

- CSV and XLSX.
- Column-name and value-pattern detection.
- PERSON, PHONE, EMAIL, ID_CARD, IP, ORG, ADDRESS.
- KEEP, MASK, TOKENIZE, REMOVE.
- Stable HMAC tokens using a local secret stored at `~/.dsh-privacy-gateway/token-secret` with mode `0600`.
- A DSH right-sidebar Privacy Gateway UI.
- Safe-copy download after policy review.

Not in v0.1: PDF, Word, OCR, NER/LLM detection, database connectors, interception of the normal attachment picker.

## Install

In DSH Desktop, open Settings → Plugins → Add plugin and enter:

```text
https://github.com/ethanrise/dsh-privacy-gateway
```

After installing, reload DSH. A 🔒 button appears in the session header and opens the Privacy Gateway tab in the right sidebar.

With the CLI: `dsh plugin --profile web add github:ethanrise/dsh-privacy-gateway`.

## Develop

```bash
npm install
npm run check
```

`lib/` is committed because DSH installs from the repository without running a build; run `npm run build` and commit `lib/` after source changes.

The repository declares `dsh.bundle` and a Web client entry.

## Data flow

```text
RAW CSV/XLSX
    |
    v
local Privacy Gateway
    |
    +-- schema + pattern scan
    +-- policy review
    +-- mask / tokenize / remove
    |
    v
SAFE CSV/XLSX
    |
    v
AI (only after the user sends the safe copy)
```

## Current limitation

The first implementation deliberately stops at generating/downloading the safe copy. Automatic "Analyze Safely" hand-off to the active DSH Session will be added only through the official staged file-upload + Session prompt APIs; the plugin will not hook private ConversationController internals just to imitate the normal attachment picker.
