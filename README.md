# dsh-privacy-gateway

Local-first privacy gateway for DeepSeek Harness.

The problem this project targets is simple:

> I want AI to analyze enterprise data, but I do not want raw customer identities and contact information to reach the model.

## Conversation masking (v0.2)

Before each model request, personal data in the conversation is replaced with placeholders:

```text
You type:     给客户张三发邮件 zs@example.com，电话 13812345678
Model sees:   给客户[PERSON_7C1E0A93B2]发邮件 [EMAIL_41D0E6F8A5]，电话 [PHONE_2B9F4C07D1]
Your screen:  给客户🔒张三发邮件 🔒zs@example.com，电话 🔒13812345678   (highlighted)
```

- Detected: PERSON (Chinese names with context such as "客户张三" or "王经理"), PHONE (mainland mobile), EMAIL, ID_CARD (checksum-validated), BANK_CARD (Luhn-validated); IP is opt-in.
- Placeholders are HMAC-derived: the same value always gets the same placeholder, so the model can still tell people apart and the prompt cache stays stable.
- The masked text is what DSH stores in the session log. The `placeholder → original` table stays on this machine (`~/.dsh-privacy-gateway/vault.json`, mode `0600`) and is read only by the plugin's own local route.
- The browser restores placeholders in place, marks each value with 🔒 and a highlight, and opens a card on click showing the type, the placeholder the model saw and the original, with copy buttons. Turn restore off per window in the Privacy Gateway tab to see exactly what the model saw.

Limits:

- Name detection is rule-based and needs context; a bare name with no label or title is not caught, and a name followed by an unusual word may be cut one character long or short.
- DSH does not allow rewriting tool arguments. If the model writes a file or runs a command, it uses the placeholder, not the original.
- Message copy buttons copy the stored text, which contains placeholders; selecting restored text copies the 🔒 marker along with it.
- Tool results (file reads, command output) are masked only with `maskToolResults: true`.

Configuration lives in the plugin's `cordis.patch.yml` row: `maskMessages`, `maskToolResults`, `entities`, `persistVault`, `maxVaultEntries`.

## Security boundary

The raw file is sent only to the local DSH Host endpoint owned by this plugin. It is parsed in memory and is **not**:

- added to the DSH attachment store;
- inserted into the conversation;
- returned in a tool result;
- written to plugin logs;
- uploaded to a remote LLM by this plugin.

Only the redacted safe copy is intended to be handed to AI.

This is a privacy boundary, not a claim that the whole machine is trusted or compromise-proof.

## Spreadsheet safe copy (v0.1)

- CSV and XLSX.
- Column-name and value-pattern detection.
- PERSON, PHONE, EMAIL, ID_CARD, IP, ORG, ADDRESS.
- KEEP, MASK, TOKENIZE, REMOVE.
- Stable HMAC tokens using a local secret stored at `~/.dsh-privacy-gateway/token-secret` with mode `0600`.
- A DSH right-sidebar Privacy Gateway UI.
- Safe-copy download after policy review.

Not included: PDF, Word, OCR, NER/LLM detection, database connectors, interception of the normal attachment picker.

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
