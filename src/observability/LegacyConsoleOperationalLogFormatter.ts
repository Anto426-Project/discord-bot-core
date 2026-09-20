import { redactOperationalText } from "./OperationalLogSanitizer.js";
import {
  type OperationalLogPrimitive,
  type OperationalLogRecord,
  type OperationalLogSinkFailure
} from "./OperationalLogTypes.js";
import type { ConsoleOperationalLogFormatter } from "./HumanReadableOperationalLogFormatter.js";

export type LegacyConsoleOperationalLogFormatterOptions = Readonly<{
  isTty?: boolean;
  colors?: boolean;
  compact?: boolean;
  columns?: number;
}>;

type LegacyVisualLevel = Readonly<{
  label: "DEBUG" | "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "FATAL";
  symbol: string;
  ansi: number;
}>;

const ANSI_ESCAPE_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SENSITIVE_KEY_PATTERN =
  /(?:authorization|bearer|cookie|credential|password|passwd|secret|session|token|api[_.-]?key)/i;
const MINIMUM_WIDTH = 60;
const DEFAULT_WIDTH = 120;
const MAXIMUM_WIDTH = 140;
const SUMMARY_LIMIT = 360;
const DETAIL_LIMIT = 220;
const ATTRIBUTE_LIMIT = 8;
const STACK_LINE_LIMIT = 3;

const cleanText = (value: string, maximumLength: number): string => {
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(CONTROL_CHARACTER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  const redacted = redactOperationalText(normalized, maximumLength + 1);
  if (redacted.length === 0) {
    return "-";
  }
  return redacted.length <= maximumLength
    ? redacted
    : `${redacted.slice(0, Math.max(1, maximumLength - 1))}…`;
};

const formatPrimitive = (
  key: string,
  value: OperationalLogPrimitive
): string => {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }
  return cleanText(String(value), DETAIL_LIMIT);
};

const compareEntries = (
  left: readonly [string, unknown],
  right: readonly [string, unknown]
): number => left[0].localeCompare(right[0], "en");

const formatTime = (occurredAt: Date): string => {
  if (!Number.isFinite(occurredAt.getTime())) {
    return "invalid-time";
  }
  return occurredAt.toISOString().slice(11, 23);
};

const resolveVisualLevel = (
  record: OperationalLogRecord
): LegacyVisualLevel => {
  if (record.severity === "fatal") {
    return { label: "FATAL", symbol: "💥", ansi: 31 };
  }
  if (record.severity === "error") {
    return { label: "ERROR", symbol: "❌", ansi: 31 };
  }
  if (record.outcome === "failed") {
    return { label: "ERROR", symbol: "❌", ansi: 31 };
  }
  if (record.severity === "warn" || record.outcome === "degraded") {
    return { label: "WARNING", symbol: "⚠️", ansi: 33 };
  }
  if (record.severity === "debug") {
    return { label: "DEBUG", symbol: "🔧", ansi: 35 };
  }
  if (
    record.kind === "milestone" &&
    (record.outcome === "ok" || record.outcome === "recovered")
  ) {
    return { label: "SUCCESS", symbol: "✅", ansi: 32 };
  }
  return { label: "INFO", symbol: "💠", ansi: 36 };
};

const wrapText = (value: string, width: number): readonly string[] => {
  const words = value.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return ["-"];
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > width) {
      if (current.length > 0) {
        lines.push(current);
        current = "";
      }
      for (let offset = 0; offset < word.length; offset += width) {
        lines.push(word.slice(offset, offset + width));
      }
      continue;
    }
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
};

const recordDetails = (record: OperationalLogRecord): readonly string[] => {
  const outcome = record.outcome ??
    (record.kind === "error" ||
    record.kind === "collector_error" ||
    record.kind === "persistent_error"
      ? "failed"
      : "n/a");
  const details = [
    `Outcome: ${cleanText(outcome, DETAIL_LIMIT)}`,
    `Correlation: ${cleanText(record.correlationId, DETAIL_LIMIT)}`,
    ...(record.traceId === undefined
      ? []
      : [`Trace: ${cleanText(record.traceId, DETAIL_LIMIT)}`]),
    ...(record.durationMs === undefined
      ? []
      : [`Duration: ${record.durationMs} ms`]),
    ...("category" in record
      ? [`Category: ${cleanText(record.category, DETAIL_LIMIT)}`]
      : [])
  ];

  const references = Object.entries(record.references)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(compareEntries);
  if (references.length > 0) {
    details.push(
      `References: ${references
        .map(
          ([key, value]) =>
            `${cleanText(key, 60)}=${cleanText(value, DETAIL_LIMIT)}`
        )
        .join(" · ")}`
    );
  }

  if ("attributes" in record) {
    const attributes = Object.entries(record.attributes).sort(compareEntries);
    const visibleAttributes = attributes.slice(0, ATTRIBUTE_LIMIT);
    if (visibleAttributes.length > 0) {
      const omitted = attributes.length - visibleAttributes.length;
      details.push(
        `Details: ${visibleAttributes
          .map(
            ([key, value]) =>
              `${cleanText(key, 60)}=${formatPrimitive(key, value)}`
          )
          .join(" · ")}${omitted > 0 ? ` · …(+${omitted})` : ""}`
      );
    }
  }

  if (
    record.kind === "error" ||
    record.kind === "collector_error" ||
    record.kind === "persistent_error"
  ) {
    const fingerprint =
      record.kind === "error" || record.kind === "persistent_error"
        ? ` · fingerprint=${record.fingerprintSha256.slice(0, 12)}`
        : "";
    details.push(
      `Error: ${cleanText(record.errorClass, DETAIL_LIMIT)} · code=${cleanText(
        record.errorCode,
        DETAIL_LIMIT
      )} · retryable=${record.retryable ? "yes" : "no"}${
        record.providerCode === undefined
          ? ""
          : ` · provider=${cleanText(record.providerCode, DETAIL_LIMIT)}`
      }${
        record.attemptNo === undefined ? "" : ` · attempt=${record.attemptNo}`
      }${fingerprint}`
    );
    if (record.redactedStack !== undefined) {
      const stack = record.redactedStack
        .split(/\r?\n/)
        .map((line) => cleanText(line, DETAIL_LIMIT))
        .filter((line) => line !== "-")
        .slice(0, STACK_LINE_LIMIT);
      if (stack.length > 0) {
        details.push(`Stack: ${stack.join(" ← ")}`);
      }
    }
  }

  return details;
};

const compactRecordDetails = (record: OperationalLogRecord): string => {
  const details: string[] = [];
  const isError =
    record.kind === "error" ||
    record.kind === "collector_error" ||
    record.kind === "persistent_error";
  const references = Object.entries(record.references)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(compareEntries);
  if (references.length > 0) {
    details.push(
      references
        .map(
          ([key, value]) =>
            `${cleanText(key, 40)}=${cleanText(value, 80)}`
        )
        .join(" ")
    );
  }

  if (isError) {
    details.push(
      `${cleanText(record.errorClass, 60)}/${cleanText(record.errorCode, 100)}${
        record.retryable ? " retryable" : ""
      }`
    );
    if (record.redactedStack !== undefined) {
      const firstLine = record.redactedStack.split(/\r?\n/, 1)[0];
      if (firstLine !== undefined) {
        const cause = cleanText(firstLine, 180).replace(
          new RegExp(`^${record.errorClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*`),
          ""
        );
        if (cause !== "-") {
          details.push(`cause=${cause}`);
        }
      }
    }
  } else if ("attributes" in record) {
    const attributes = Object.entries(record.attributes)
      .sort(compareEntries)
      .slice(0, 4);
    if (attributes.length > 0) {
      details.push(
        attributes
          .map(
            ([key, value]) =>
              `${cleanText(key, 40)}=${formatPrimitive(key, value)}`
          )
          .join(" ")
      );
    }
  }

  const outcome = record.outcome ?? (isError ? "failed" : undefined);
  if (outcome === "degraded" || outcome === "failed") {
    details.push(`outcome=${outcome}`);
  }
  details.push(`cid=${cleanText(record.correlationId, 80).slice(0, 8)}`);
  return details.join(" | ");
};

/**
 * Terminal projection inspired by the previous BotConsole presentation.
 * It is deliberately presentation-only: the canonical structured record is
 * still handed unchanged to an independent persistent sink.
 */
export class LegacyConsoleOperationalLogFormatter
  implements ConsoleOperationalLogFormatter
{
  private readonly isTty: boolean;
  private readonly useColors: boolean;
  private readonly compact: boolean;
  private readonly columns: number;

  public constructor(options: LegacyConsoleOperationalLogFormatterOptions = {}) {
    this.isTty = options.isTty === true;
    this.useColors = this.isTty && options.colors !== false;
    this.compact = options.compact === true || !this.isTty;
    const requestedColumns = options.columns ?? DEFAULT_WIDTH;
    this.columns = Number.isFinite(requestedColumns)
      ? Math.min(
          MAXIMUM_WIDTH,
          Math.max(MINIMUM_WIDTH, Math.floor(requestedColumns))
        )
      : DEFAULT_WIDTH;
  }

  public format(record: OperationalLogRecord): string {
    const level = resolveVisualLevel(record);
    return this.compact
      ? this.renderCompact(record, level)
      : this.renderExpanded(record, level);
  }

  public formatSinkFailure(
    failure: OperationalLogSinkFailure,
    sourceRecord: OperationalLogRecord,
    occurredAt: Date
  ): string {
    const safeFailure = cleanText(failure.code, DETAIL_LIMIT);
    const safeSink = SENSITIVE_KEY_PATTERN.test(failure.sinkKey)
      ? "[redacted]"
      : cleanText(failure.sinkKey, DETAIL_LIMIT);
    const summary = `Operational log sink failed: ${safeFailure}; sink=${safeSink}; source=${cleanText(
      sourceRecord.eventKey,
      DETAIL_LIMIT
    )}`;
    const prefix = `[${formatTime(occurredAt)}] [❌ ERROR] [operational-logging]`;
    return `${this.paint(prefix, 31)} ${summary}`;
  }

  private renderCompact(
    record: OperationalLogRecord,
    level: LegacyVisualLevel
  ): string {
    const prefix = `[${formatTime(record.occurredAt)}] [${level.symbol} ${level.label}] [${cleanText(
      record.component,
      80
    )}]`;
    const main = `${cleanText(record.eventKey, 100)} — ${cleanText(
      record.summary,
      SUMMARY_LIMIT
    )}`;
    const details = compactRecordDetails(record);
    return `${this.paint(prefix, level.ansi)} ${main} | ${details}`;
  }

  private renderExpanded(
    record: OperationalLogRecord,
    level: LegacyVisualLevel
  ): string {
    const innerWidth = this.columns - 4;
    const border = (text: string): string => this.paint(text, level.ansi);
    const line = "─".repeat(innerWidth + 2);
    const renderLine = (value: string, color = false): string => {
      const visible = value.slice(0, innerWidth);
      const padded = visible.padEnd(innerWidth);
      return `${border("│")} ${color ? this.paint(padded, level.ansi) : padded} ${border("│")}`;
    };
    const renderWrapped = (value: string): readonly string[] =>
      wrapText(value, innerWidth).map((lineValue) => renderLine(lineValue));

    const header = `${level.symbol} ${level.label}  ${cleanText(
      record.component,
      innerWidth - 14
    )}`;
    const event = `[${formatTime(record.occurredAt)}] ${cleanText(
      record.eventKey,
      innerWidth - 16
    )}`;
    const details = recordDetails(record).flatMap((detail) =>
      renderWrapped(`• ${detail}`)
    );

    return [
      border(`╭${line}╮`),
      renderLine(header, true),
      renderLine(event),
      border(`├${line}┤`),
      ...renderWrapped(cleanText(record.summary, SUMMARY_LIMIT)),
      border(`├${line}┤`),
      ...details,
      border(`╰${line}╯`)
    ].join("\n");
  }

  private paint(value: string, ansi: number): string {
    return this.useColors ? `\u001B[${ansi}m${value}\u001B[0m` : value;
  }
}
