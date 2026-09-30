# dsh-privacy-gateway

English · [简体中文](README.zh.md)

Local privacy gateway for DeepSeek Harness (DSH).

> I want AI to work with customer data, but I do not want real names, phone numbers and ID numbers to reach the model.

It does two things:

- **Conversation masking.** Before each model request, personal data in your messages is replaced with placeholders. The model and the session log only ever see the placeholders; your screen shows the originals, marked with 🔒.
- **Spreadsheet safe copy.** A CSV/XLSX file is scanned column by column on this machine and turned into a redacted copy that you can hand to AI instead of the original.

Everything is in the **🔒 Privacy Gateway** tab of the right sidebar (the 🔒 button in the session header opens it). The UI follows DSH's language setting (Chinese or English).

## Install

In DSH Desktop, open Settings → Plugins → Add plugin and enter:

```text
https://github.com/ethanrise/dsh-privacy-gateway
```

Reload DSH afterwards. With the CLI: `dsh plugin --profile web add github:ethanrise/dsh-privacy-gateway`.

## Conversation masking

```text
You type:     给客户张三发邮件 zs@example.com，电话 13812345678
Model sees:   给客户[PERSON_7C1E0A93B2]发邮件 [EMAIL_41D0E6F8A5]，电话 [PHONE_2B9F4C07D1]
Your screen:  给客户🔒张三发邮件 🔒zs@example.com，电话 🔒13812345678
```

What is detected by rules:

| Type | How |
|---|---|
| PERSON | Chinese names with context: a label before them ("客户张三", "联系人：欧阳"), a title after them ("王经理", "李建国女士"), or "的" plus a contact word ("王小二的邮箱") |
| PHONE | Mainland-China mobile numbers, with or without +86, spaces or dashes |
| EMAIL | Email addresses |
| ID_CARD | Mainland-China resident ID numbers, checksum-validated |
| BANK_CARD | 16–19 digit card numbers, Luhn-validated |
| IP | IPv4 addresses (off by default: frequent in technical text) |

**Word list.** Names the rules cannot catch (companies, people without context, project code names) go into the word list in the sidebar, one term per line, or imported from a column of a CSV/XLSX customer list. Each term is matched exactly (Latin text case-insensitively, longest term first). No short forms are derived: listing `字节跳动有限公司` does not mask `字节跳动`; list that separately if you write it that way.

**Placeholders** are HMAC-derived from a local secret: the same value always gets the same placeholder, so the model can still tell people apart and refer back to them, and the prompt cache stays stable. You never maintain placeholders yourself.

**On screen**, placeholders are restored in place, prefixed with 🔒 and highlighted, including in the model's replies (with or without the brackets). Click one to see its type, the placeholder the model saw and the original, with copy buttons. Turn "show originals" off to see exactly what the model saw. Anything without a 🔒 was sent as plain text.

## Spreadsheet safe copy

1. Pick a CSV or XLSX file in the sidebar. It is parsed in memory on this machine.
2. Each column is classified from its header and values (PERSON, PHONE, EMAIL, ID_CARD, IP, ORG, ADDRESS) with a confidence and a recommended action.
3. Choose KEEP, MASK (`138****5678`), TOKENIZE (stable HMAC token) or REMOVE per column.
4. Download `<name>.safe.csv` / `<name>.safe.xlsx` and send that copy to AI yourself.

## Where data lives

All of it stays on this machine, under `~/.dsh-privacy-gateway/` with mode `0600`:

| File | Content |
|---|---|
| `token-secret` | HMAC key for placeholders and tokens |
| `vault.json` | placeholder → original, so the UI can restore history after a restart |
| `dictionary.json` | your word list |

The browser reads originals only through the plugin's own local routes. See [SECURITY.md](SECURITY.md) for the boundary.

## Limits

- Name detection is rule-based: a bare name with no label, title or contact word is not caught unless it is in the word list, and a name followed by an unusual word may be cut one character long or short.
- Addresses and company names are not detected by rules; use the word list.
- DSH does not let plugins rewrite tool arguments, so when the model writes a file or runs a command it uses the placeholder, not the original.
- Tool results (file reads, command output) are masked only with `maskToolResults: true`, off by default because the model may then write placeholders into files it edits.
- Message copy buttons copy the stored text, which contains placeholders; selecting restored text copies the 🔒 marker with it.
- Masking and word-list changes apply to messages sent afterwards, not to messages already sent.
- A spreadsheet safe copy is handed to AI by you; the plugin does not attach it to the session.

## Configuration

In the plugin's `cordis.patch.yml` row:

| Key | Default | Meaning |
|---|---|---|
| `maskMessages` | `true` | mask conversation messages before the model sees them (also switchable in the sidebar) |
| `maskToolResults` | `false` | also mask tool results |
| `entities` | `[PERSON, PHONE, EMAIL, ID_CARD, BANK_CARD]` | rule types to detect; add `IP` to enable it |
| `persistVault` | `true` | keep `vault.json` on disk |
| `maxVaultEntries` | `20000` | oldest entries are dropped past this |

## Develop

```bash
npm install
npm run check   # typecheck, tests, build
```

`lib/` is committed because DSH installs from the repository without running a build: the host entry is bundled with its dependencies by esbuild, and the browser entry is a single module. Run `npm run build` and commit `lib/` after source changes. Bumping `version` in `package.json` on `main` publishes a release with a prebuilt `dsh-privacy-gateway.tgz`.
