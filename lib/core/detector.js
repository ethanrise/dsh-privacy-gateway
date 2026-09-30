const HEADER_RULES = [
    { kind: "EMAIL", patterns: [/email/i, /e-mail/i, /邮箱/, /邮件/] },
    { kind: "PHONE", patterns: [/phone/i, /mobile/i, /tel/i, /手机号/, /电话/, /联系电话/, /whatsapp/i, /微信号/] },
    { kind: "ID_CARD", patterns: [/id.?card/i, /identity/i, /身份证/, /证件号/, /passport/i, /护照/] },
    { kind: "PERSON", patterns: [/customer.?name/i, /contact.?name/i, /^name$/i, /客户姓名/, /联系人/, /姓名/, /负责人/] },
    { kind: "ORG", patterns: [/company/i, /organization/i, /org/i, /公司/, /企业/, /客户名称/, /单位/] },
    { kind: "ADDRESS", patterns: [/address/i, /地址/, /住址/, /收货地址/] },
    { kind: "IP", patterns: [/ip.?address/i, /^ip$/i] },
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CN_MOBILE = /^(?:\+?86[- ]?)?1[3-9]\d{9}$/;
const CN_ID = /^\d{17}[\dXx]$/;
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
function normalize(value) {
    if (value === null || value === undefined)
        return "";
    if (value instanceof Date)
        return value.toISOString();
    return String(value).trim();
}
function detectHeader(header) {
    for (const rule of HEADER_RULES) {
        if (rule.patterns.some(pattern => pattern.test(header)))
            return rule.kind;
    }
    return undefined;
}
function detectValue(value) {
    if (EMAIL.test(value))
        return "EMAIL";
    if (CN_MOBILE.test(value.replace(/[\s-]/g, "")))
        return "PHONE";
    if (CN_ID.test(value))
        return "ID_CARD";
    if (IPV4.test(value))
        return "IP";
    return undefined;
}
export function recommendedAction(kind) {
    switch (kind) {
        case "PHONE":
        case "ID_CARD":
            return "MASK";
        case "PERSON":
        case "EMAIL":
        case "ORG":
        case "ADDRESS":
        case "IP":
            return "TOKENIZE";
        case "UNKNOWN":
            return "KEEP";
    }
}
export function scanSheet(sheet) {
    return sheet.headers.map((header, index) => {
        const headerKind = detectHeader(header);
        const counts = new Map();
        let nonEmptyValues = 0;
        for (const row of sheet.rows) {
            const value = normalize(row[index]);
            if (value.length === 0)
                continue;
            nonEmptyValues += 1;
            const detected = detectValue(value);
            if (detected !== undefined)
                counts.set(detected, (counts.get(detected) ?? 0) + 1);
        }
        let valueKind;
        let valueMatches = 0;
        for (const [kind, count] of counts) {
            if (count > valueMatches) {
                valueKind = kind;
                valueMatches = count;
            }
        }
        const kind = headerKind ?? (valueKind !== undefined && nonEmptyValues > 0 && valueMatches / nonEmptyValues >= 0.6
            ? valueKind
            : "UNKNOWN");
        const matchedValues = headerKind !== undefined ? nonEmptyValues : valueMatches;
        const confidence = headerKind !== undefined
            ? 0.95
            : nonEmptyValues === 0 ? 0 : Math.min(0.9, valueMatches / nonEmptyValues);
        return {
            index,
            name: header || `Column ${index + 1}`,
            kind,
            confidence,
            matchedValues,
            nonEmptyValues,
            recommendedAction: recommendedAction(kind),
        };
    });
}
