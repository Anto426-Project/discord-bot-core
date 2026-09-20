import type {
  OperationalLogFallback,
  OperationalLogRecord,
  OperationalLogSeverity,
  OperationalLogSink,
  OperationalLogSinkFailure
} from "./OperationalLogTypes.js";
import {
  type ConsoleOperationalLogFormatter
} from "./HumanReadableOperationalLogFormatter.js";
import { LegacyConsoleOperationalLogFormatter } from "./LegacyConsoleOperationalLogFormatter.js";

export type ConsoleLogWriter = (
  line: string,
  severity: OperationalLogSeverity
) => void;

const severityRank: Readonly<Record<OperationalLogSeverity, number>> =
  Object.freeze({
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50
  });
const SINK_FAILURE_REPEAT_WINDOW_MS = 30_000;

const defaultWriter: ConsoleLogWriter = (line, severity) => {
  const spacedLine = `${line}\n`;
  if (severity === "error" || severity === "fatal") {
    console.error(spacedLine);
    return;
  }
  if (severity === "warn") {
    console.warn(spacedLine);
    return;
  }
  console.log(spacedLine);
};

const createDefaultFormatter = (): ConsoleOperationalLogFormatter =>
  new LegacyConsoleOperationalLogFormatter({
    isTty: process.stdout?.isTTY === true,
    colors: process.stdout?.hasColors?.() ?? process.stdout?.isTTY === true,
    compact: true,
    columns: process.stdout?.columns
  });

export class ConsoleOperationalLogSink
  implements OperationalLogSink, OperationalLogFallback
{
  public readonly key = "console";
  public readonly kind = "collector" as const;
  private readonly sinkFailureReportedAt = new Map<string, number>();

  public constructor(
    private readonly minimumSeverity: OperationalLogSeverity = "info",
    private readonly writer: ConsoleLogWriter = defaultWriter,
    private readonly formatter: ConsoleOperationalLogFormatter =
      createDefaultFormatter()
  ) {}

  public async write(record: OperationalLogRecord): Promise<void> {
    if (severityRank[record.severity] < severityRank[this.minimumSeverity]) {
      return;
    }
    this.writer(this.formatter.format(record), record.severity);
  }

  public reportSinkFailure(
    failure: OperationalLogSinkFailure,
    record: OperationalLogRecord
  ): void {
    try {
      const now = Date.now();
      const previous = this.sinkFailureReportedAt.get(failure.sinkKey);
      if (
        previous !== undefined &&
        now - previous < SINK_FAILURE_REPEAT_WINDOW_MS
      ) {
        return;
      }
      this.sinkFailureReportedAt.set(failure.sinkKey, now);
      this.writer(
        this.formatter.formatSinkFailure(failure, record, new Date(now)),
        "error"
      );
    } catch {
      // Terminal fallback: never recurse and never affect the caller.
    }
  }
}
