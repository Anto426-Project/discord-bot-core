import type {
  ErrorOperationalLogInput,
  OperationalLogContextInput,
  OperationalLogOutcome,
  OperationalLogPrimitive,
  OperationalLogReferences,
  TransientOperationalLogInput
} from "./OperationalLogTypes.js";

const IDENTIFIER_MAX_LENGTH = 191;
const SUMMARY_MAX_LENGTH = 500;
const ATTRIBUTE_VALUE_MAX_LENGTH = 2_048;
const STACK_MAX_LENGTH = 16_384;
const MAX_ATTRIBUTE_COUNT = 32;
const ATTRIBUTE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const SENSITIVE_KEY_PATTERN =
  /(?:authorization|bearer|cookie|credential|password|passwd|secret|session|token|api[_.-]?key)/i;

const truncate = (value: string, maximumLength: number): string =>
  value.length <= maximumLength ? value : value.slice(0, maximumLength);

export const redactOperationalText = (
  input: string,
  maximumLength: number
): string =>
  truncate(
    input
      .replace(
        /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
        "Bearer [redacted]"
      )
      .replace(
        /\b(?:Basic)\s+[A-Za-z0-9+/]+=*/gi,
        "Basic [redacted]"
      )
      .replace(
        /\b(?=[A-Za-z0-9_.-]*[A-Z0-9])[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
        "[redacted-token]"
      )
      .replace(
        /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi,
        "$1[redacted]@"
      )
      .replace(/\b(?:set-)?cookie\s*[:=]\s*[^\r\n]+/gi, "cookie=[redacted]")
      .replace(
        /\b[A-Za-z0-9_.-]*(?:authorization|bearer|cookie|credential|password|passwd|secret|session|token|api[_.-]?key)[A-Za-z0-9_.-]*\s*[:=]\s*[^,\s;&]+/gi,
        (match) => {
          const separatorIndex = match.search(/[:=]/);
          const key =
            separatorIndex < 0
              ? "secret"
              : match.slice(0, separatorIndex).trim();
          return `${key || "secret"}=[redacted]`;
        }
      )
      .replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        "[redacted-email]"
      )
      .replace(
        /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
        "[redacted-ip]"
      )
      .replace(
        /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/gi,
        "[redacted-ip]"
      )
      .replace(
        /(?:[A-Za-z]:\\Users\\|\/home\/)[^/\\\s]+/g,
        (match) =>
          match.includes("\\")
            ? `${match.slice(0, match.lastIndexOf("\\") + 1)}[redacted-user]`
            : "/home/[redacted-user]"
      ),
    maximumLength
  );

const sanitizeIdentifier = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const sanitized = redactOperationalText(
    value.trim(),
    IDENTIFIER_MAX_LENGTH + 1
  );
  return sanitized.length === 0 || sanitized.length > IDENTIFIER_MAX_LENGTH
    ? null
    : sanitized;
};

const sanitizeSummary = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const sanitized = redactOperationalText(value.trim(), SUMMARY_MAX_LENGTH);
  return sanitized.length === 0 ? null : sanitized;
};

const sanitizeReferences = (
  references: OperationalLogReferences | undefined
): OperationalLogReferences | null => {
  if (references === undefined) {
    return Object.freeze({});
  }
  const entries = Object.entries(references);
  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (
      key !== "guildId" &&
      key !== "principalId" &&
      key !== "operationId" &&
      key !== "jobRunId"
    ) {
      return null;
    }
    const sanitized = sanitizeIdentifier(value);
    if (sanitized === null) {
      return null;
    }
    result[key] = sanitized;
  }
  return Object.freeze(result);
};

const sanitizeAttributes = (
  attributes:
    | Readonly<Record<string, OperationalLogPrimitive>>
    | undefined
): Readonly<Record<string, OperationalLogPrimitive>> | null => {
  if (attributes === undefined) {
    return Object.freeze({});
  }
  const entries = Object.entries(attributes);
  if (entries.length > MAX_ATTRIBUTE_COUNT) {
    return null;
  }
  const result: Record<string, OperationalLogPrimitive> = {};
  for (const [key, value] of entries) {
    if (!ATTRIBUTE_KEY_PATTERN.test(key)) {
      return null;
    }
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return null;
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return null;
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = "[redacted]";
      continue;
    }
    result[key] =
      typeof value === "string"
        ? redactOperationalText(value, ATTRIBUTE_VALUE_MAX_LENGTH)
        : value;
  }
  return Object.freeze(result);
};

export type SanitizedOperationalContext = Readonly<{
  occurredAt: Date;
  correlationId: string;
  traceId?: string;
  references: OperationalLogReferences;
  durationMs?: number;
  outcome?: OperationalLogOutcome;
  attributes: Readonly<Record<string, OperationalLogPrimitive>>;
}>;

export const sanitizeOperationalContext = (
  input: OperationalLogContextInput,
  fallbackOccurredAt: Date
): SanitizedOperationalContext | null => {
  const correlationId = sanitizeIdentifier(input.correlationId);
  const traceId =
    input.traceId === undefined ? undefined : sanitizeIdentifier(input.traceId);
  const references = sanitizeReferences(input.references);
  const attributes = sanitizeAttributes(input.attributes);
  const occurredAt = input.occurredAt ?? fallbackOccurredAt;
  if (
    correlationId === null ||
    traceId === null ||
    references === null ||
    attributes === null ||
    !Number.isFinite(occurredAt.getTime()) ||
    (input.durationMs !== undefined &&
      (!Number.isSafeInteger(input.durationMs) || input.durationMs < 0))
  ) {
    return null;
  }

  return Object.freeze({
    occurredAt: new Date(occurredAt.getTime()),
    correlationId,
    ...(traceId === undefined ? {} : { traceId }),
    references,
    ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
    ...(input.outcome === undefined ? {} : { outcome: input.outcome }),
    attributes
  });
};

export type SanitizedTransientInput = SanitizedOperationalContext &
  Readonly<{
    eventKey: string;
    component: string;
    summary: string;
  }>;

export const sanitizeTransientInput = (
  input: TransientOperationalLogInput,
  fallbackOccurredAt: Date
): SanitizedTransientInput | null => {
  const context = sanitizeOperationalContext(input, fallbackOccurredAt);
  const eventKey = sanitizeIdentifier(input.eventKey);
  const component = sanitizeIdentifier(input.component);
  const summary = sanitizeSummary(input.summary);
  if (
    context === null ||
    eventKey === null ||
    component === null ||
    summary === null
  ) {
    return null;
  }
  return Object.freeze({ ...context, eventKey, component, summary });
};

export type SanitizedErrorInput = SanitizedOperationalContext &
  Readonly<{
    errorCode: string;
    component: string;
    safeSummary: string;
    errorClass: string;
    providerCode?: string;
    retryable: boolean;
    attemptNo?: number;
    normalizedCause: string;
    redactedStack?: string;
  }>;

const normalizedDynamicValues = (value: string): string =>
  value
    .toLowerCase()
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "<id>"
    )
    .replace(/\b[0-9]{8,20}\b/g, "<id>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCause = (error: unknown): string => {
  if (error === undefined) {
    return "none";
  }
  if (error instanceof Error) {
    const chain: string[] = [];
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
      chain.push(
        `${current.name}:${normalizedDynamicValues(
          redactOperationalText(current.message, ATTRIBUTE_VALUE_MAX_LENGTH)
        )}`
      );
      current = current.cause;
    }
    return chain.join(" <- ");
  }
  if (typeof error === "string") {
    return `string:${normalizedDynamicValues(
      redactOperationalText(error, ATTRIBUTE_VALUE_MAX_LENGTH)
    )}`;
  }
  return `non_error:${typeof error}`;
};

export const sanitizeErrorInput = (
  input: ErrorOperationalLogInput,
  fallbackOccurredAt: Date
): SanitizedErrorInput | null => {
  const context = sanitizeOperationalContext(input, fallbackOccurredAt);
  const errorCode = sanitizeIdentifier(input.errorCode);
  const component = sanitizeIdentifier(input.component);
  const safeSummary = sanitizeSummary(input.safeSummary);
  const inferredClass =
    input.errorClass ??
    (input.error instanceof Error && input.error.name.trim().length > 0
      ? input.error.name
      : "UnknownError");
  const errorClass = sanitizeIdentifier(inferredClass);
  const providerCode =
    input.providerCode === undefined
      ? undefined
      : sanitizeIdentifier(input.providerCode);
  if (
    context === null ||
    errorCode === null ||
    component === null ||
    safeSummary === null ||
    errorClass === null ||
    providerCode === null ||
    (input.attemptNo !== undefined &&
      (!Number.isSafeInteger(input.attemptNo) || input.attemptNo < 1))
  ) {
    return null;
  }

  const stack =
    input.error instanceof Error && typeof input.error.stack === "string"
      ? redactOperationalText(input.error.stack, STACK_MAX_LENGTH)
      : undefined;
  return Object.freeze({
    ...context,
    errorCode,
    component,
    safeSummary,
    errorClass,
    ...(providerCode === undefined ? {} : { providerCode }),
    retryable: input.retryable,
    ...(input.attemptNo === undefined ? {} : { attemptNo: input.attemptNo }),
    normalizedCause: normalizeCause(input.error),
    ...(stack === undefined || stack.length === 0
      ? {}
      : { redactedStack: stack })
  });
};

export const sanitizeCatalogEntry = (entry: {
  eventKey: string;
  component: string;
  description: string;
}): Readonly<{
  eventKey: string;
  component: string;
  description: string;
}> | null => {
  const eventKey = sanitizeIdentifier(entry.eventKey);
  const component = sanitizeIdentifier(entry.component);
  const description = sanitizeSummary(entry.description);
  return eventKey === null || component === null || description === null
    ? null
    : Object.freeze({ eventKey, component, description });
};
