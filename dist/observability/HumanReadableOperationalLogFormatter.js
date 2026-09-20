import { redactOperationalText } from "./OperationalLogSanitizer.js";
import {} from "./OperationalLogTypes.js";
const SUMMARY_MAX_LENGTH = 300;
const CONTEXT_VALUE_MAX_LENGTH = 160;
const STACK_LINE_MAX_LENGTH = 240;
const STACK_LINE_LIMIT = 3;
const ATTRIBUTE_LIMIT = 8;
const SENSITIVE_KEY_PATTERN = /(?:authorization|bearer|cookie|credential|password|passwd|secret|session|token|api[_.-]?key)/i;
const isErrorRecord = (record) => record.kind === "error" ||
    record.kind === "collector_error" ||
    record.kind === "persistent_error";
const cleanText = (value, maximumLength) => {
    const singleLine = value.replace(/\s+/g, " ").trim();
    const redacted = redactOperationalText(singleLine, maximumLength + 1);
    return redacted.length <= maximumLength
        ? redacted
        : `${redacted.slice(0, maximumLength - 1)}…`;
};
const renderString = (value) => {
    const cleaned = cleanText(value, CONTEXT_VALUE_MAX_LENGTH);
    return /^[A-Za-z0-9_.:/@+-]+$/.test(cleaned)
        ? cleaned
        : JSON.stringify(cleaned);
};
const renderPrimitive = (key, value) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
        return renderString("[redacted]");
    }
    if (typeof value !== "string") {
        return String(value);
    }
    return renderString(value);
};
const compareKeys = (left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
const renderReferences = (record) => {
    const entries = Object.entries(record.references)
        .filter((entry) => typeof entry[1] === "string")
        .sort(compareKeys);
    if (entries.length === 0) {
        return null;
    }
    return `refs ${entries
        .map(([key, value]) => `${key}=${renderString(value)}`)
        .join(" ")}`;
};
const renderAttributes = (record) => {
    if (!("attributes" in record)) {
        return null;
    }
    const entries = Object.entries(record.attributes).sort(compareKeys);
    if (entries.length === 0) {
        return null;
    }
    const visible = entries.slice(0, ATTRIBUTE_LIMIT);
    const omittedCount = entries.length - visible.length;
    return `attrs ${visible
        .map(([key, value]) => `${key}=${renderPrimitive(key, value)}`)
        .join(" ")}${omittedCount === 0 ? "" : ` …(+${omittedCount} attributes)`}`;
};
const renderStack = (redactedStack) => {
    if (redactedStack === undefined) {
        return null;
    }
    const lines = redactedStack
        .split(/\r?\n/)
        .map((line) => cleanText(line, STACK_LINE_MAX_LENGTH))
        .filter((line) => line.length > 0);
    if (lines.length === 0) {
        return null;
    }
    const visible = lines.slice(0, STACK_LINE_LIMIT);
    const omittedCount = lines.length - visible.length;
    return `stack ${visible.join(" ← ")}${omittedCount === 0 ? "" : ` …(+${omittedCount} lines)`}`;
};
const renderTimestamp = (occurredAt) => Number.isFinite(occurredAt.getTime())
    ? occurredAt.toISOString()
    : "invalid-timestamp";
const renderError = (record) => {
    const details = [
        `class=${renderString(record.errorClass)}`,
        `code=${renderString(record.errorCode)}`,
        `retryable=${record.retryable ? "yes" : "no"}`,
        ...(record.providerCode === undefined
            ? []
            : [`provider=${renderString(record.providerCode)}`]),
        ...(record.attemptNo === undefined
            ? []
            : [`attempt=${record.attemptNo}`]),
        ...(record.kind === "error" || record.kind === "persistent_error"
            ? [`fingerprint=${record.fingerprintSha256.slice(0, 12)}`]
            : [])
    ];
    return `error ${details.join(" ")}`;
};
export class HumanReadableOperationalLogFormatter {
    format(record) {
        const errorRecord = isErrorRecord(record) ? record : null;
        const outcome = record.outcome ?? (errorRecord === null ? "n/a" : "failed");
        const context = [
            `outcome=${outcome}`,
            `correlation=${renderString(record.correlationId)}`,
            ...(record.traceId === undefined
                ? []
                : [`trace=${renderString(record.traceId)}`]),
            ...(record.durationMs === undefined
                ? []
                : [`duration=${record.durationMs}ms`]),
            ...("category" in record ? [`category=${record.category}`] : [])
        ];
        const segments = [
            `${renderTimestamp(record.occurredAt)} ${record.severity
                .toUpperCase()
                .padEnd(5)} [${cleanText(record.component, CONTEXT_VALUE_MAX_LENGTH)}] ${cleanText(record.eventKey, CONTEXT_VALUE_MAX_LENGTH)} — ${cleanText(record.summary, SUMMARY_MAX_LENGTH)}`,
            context.join(" ")
        ];
        const references = renderReferences(record);
        const attributes = renderAttributes(record);
        if (references !== null) {
            segments.push(references);
        }
        if (attributes !== null) {
            segments.push(attributes);
        }
        if (errorRecord !== null) {
            segments.push(renderError(errorRecord));
            const stack = renderStack(errorRecord.redactedStack);
            if (stack !== null) {
                segments.push(stack);
            }
        }
        return segments.join(" | ");
    }
    formatSinkFailure(failure, sourceRecord, occurredAt) {
        return [
            `${renderTimestamp(occurredAt)} ERROR [operational-logging] sink.write_failed — An operational log sink failed to write.`,
            `outcome=failed correlation=${renderString(sourceRecord.correlationId)}`,
            `error code=${failure.code} failedSink=${renderString(failure.sinkKey)} sourceEvent=${renderString(sourceRecord.eventKey)} sourceComponent=${renderString(sourceRecord.component)}`
        ].join(" | ");
    }
}
//# sourceMappingURL=HumanReadableOperationalLogFormatter.js.map