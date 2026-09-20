type Clock = Readonly<{ now(): Date }>;
import type {
  CollectorErrorOperationalLogRecord,
  ErrorOperationalLogInput,
  ErrorOperationalLogRecord,
  MilestoneOperationalLogInput,
  MilestoneOperationalLogRecord,
  OperationalErrorFingerprintPort,
  OperationalLogFallback,
  OperationalLogRecord,
  OperationalLogSink,
  OperationalLogSinkFailure,
  OperationalLogWriteResult,
  OperationalMilestoneCatalogEntry,
  PersistentOperationalLogRecord,
  TransientOperationalLogInput,
  TransientOperationalLogRecord
} from "./OperationalLogTypes.js";
import {
  sanitizeCatalogEntry,
  sanitizeErrorInput,
  sanitizeOperationalContext,
  sanitizeTransientInput
} from "./OperationalLogSanitizer.js";

const rejected = (
  rejectionCode: NonNullable<OperationalLogWriteResult["rejectionCode"]>
): OperationalLogWriteResult =>
  Object.freeze({
    accepted: false,
    attemptedSinkCount: 0,
    succeededSinkCount: 0,
    failureCount: 0,
    failures: Object.freeze([]),
    rejectionCode
  });

const persistentSeverityRank = Object.freeze({
  info: 10,
  warn: 20,
  error: 30,
  fatal: 40
} as const);
const operationalCategories = new Set([
  "lifecycle",
  "workflow",
  "dependency",
  "reconcile",
  "cutover"
]);

export type OperationalLoggerOptions = Readonly<{
  catalog: readonly OperationalMilestoneCatalogEntry[];
  clock: Clock;
  fingerprint: OperationalErrorFingerprintPort;
  sinks: readonly OperationalLogSink[];
  fallback?: OperationalLogFallback;
}>;

export class OperationalLogger {
  private readonly catalog: ReadonlyMap<
    string,
    OperationalMilestoneCatalogEntry
  >;
  private readonly collectorSinks: readonly OperationalLogSink[];
  private readonly persistentSinks: readonly OperationalLogSink[];

  public constructor(private readonly options: OperationalLoggerOptions) {
    const catalog = new Map<string, OperationalMilestoneCatalogEntry>();
    for (const entry of options.catalog) {
      const sanitized = sanitizeCatalogEntry(entry);
      if (sanitized === null) {
        throw new Error(`Invalid operational milestone '${entry.eventKey}'.`);
      }
      if (
        !operationalCategories.has(entry.category) ||
        !Object.hasOwn(persistentSeverityRank, entry.defaultSeverity)
      ) {
        throw new Error(`Invalid operational milestone '${entry.eventKey}'.`);
      }
      if (catalog.has(sanitized.eventKey)) {
        throw new Error(
          `Duplicate operational milestone '${sanitized.eventKey}'.`
        );
      }
      catalog.set(
        sanitized.eventKey,
        Object.freeze({
          eventKey: sanitized.eventKey,
          category: entry.category,
          component: sanitized.component,
          defaultSeverity: entry.defaultSeverity,
          description: sanitized.description
        })
      );
    }
    const sinkKeys = new Set<string>();
    for (const sink of options.sinks) {
      if (
        sink.key.trim().length === 0 ||
        sinkKeys.has(sink.key) ||
        (sink.kind !== "collector" && sink.kind !== "persistent")
      ) {
        throw new Error(`Invalid or duplicate operational sink '${sink.key}'.`);
      }
      sinkKeys.add(sink.key);
    }
    this.catalog = catalog;
    this.collectorSinks = Object.freeze(
      options.sinks.filter((sink) => sink.kind === "collector")
    );
    this.persistentSinks = Object.freeze(
      options.sinks.filter((sink) => sink.kind === "persistent")
    );
  }

  public debug(
    input: TransientOperationalLogInput
  ): Promise<OperationalLogWriteResult> {
    return this.writeTransient("debug", input);
  }

  public info(
    input: TransientOperationalLogInput
  ): Promise<OperationalLogWriteResult> {
    return this.writeTransient("info", input);
  }

  public async milestone(
    input: MilestoneOperationalLogInput
  ): Promise<OperationalLogWriteResult> {
    const catalogEntry = this.catalog.get(input.eventKey);
    if (catalogEntry === undefined) {
      return rejected("UNKNOWN_MILESTONE");
    }
    let context: ReturnType<typeof sanitizeOperationalContext>;
    try {
      context = sanitizeOperationalContext(input, this.options.clock.now());
    } catch {
      return rejected("INVALID_LOG_INPUT");
    }
    if (context === null) {
      return rejected("INVALID_LOG_INPUT");
    }
    const record: MilestoneOperationalLogRecord = Object.freeze({
      kind: "milestone",
      ...context,
      occurredAt: new Date(context.occurredAt.getTime()),
      severity:
        input.severity !== undefined &&
        persistentSeverityRank[input.severity] >
          persistentSeverityRank[catalogEntry.defaultSeverity]
          ? input.severity
          : catalogEntry.defaultSeverity,
      category: catalogEntry.category,
      eventKey: catalogEntry.eventKey,
      summary: catalogEntry.description,
      component: catalogEntry.component
    });
    return this.fanOut(record, this.toPersistentRecord(record));
  }

  public error(
    input: ErrorOperationalLogInput
  ): Promise<OperationalLogWriteResult> {
    return this.writeError("error", input);
  }

  public fatal(
    input: ErrorOperationalLogInput
  ): Promise<OperationalLogWriteResult> {
    return this.writeError("fatal", input);
  }

  private async writeTransient(
    severity: "debug" | "info",
    input: TransientOperationalLogInput
  ): Promise<OperationalLogWriteResult> {
    let sanitized: ReturnType<typeof sanitizeTransientInput>;
    try {
      sanitized = sanitizeTransientInput(input, this.options.clock.now());
    } catch {
      return rejected("INVALID_LOG_INPUT");
    }
    if (sanitized === null) {
      return rejected("INVALID_LOG_INPUT");
    }
    const record: TransientOperationalLogRecord = Object.freeze({
      kind: "transient",
      ...sanitized,
      occurredAt: new Date(sanitized.occurredAt.getTime()),
      severity,
      references: sanitized.references,
      attributes: sanitized.attributes
    });
    return this.fanOut(record, null);
  }

  private async writeError(
    severity: "error" | "fatal",
    input: ErrorOperationalLogInput
  ): Promise<OperationalLogWriteResult> {
    let sanitized: ReturnType<typeof sanitizeErrorInput>;
    try {
      sanitized = sanitizeErrorInput(input, this.options.clock.now());
    } catch {
      return rejected("INVALID_LOG_INPUT");
    }
    if (sanitized === null) {
      return rejected("INVALID_LOG_INPUT");
    }
    let fingerprintSha256: string;
    try {
      fingerprintSha256 = this.options.fingerprint.fingerprint({
        errorCode: sanitized.errorCode,
        errorClass: sanitized.errorClass,
        component: sanitized.component,
        providerCode: sanitized.providerCode ?? null,
        normalizedCause: sanitized.normalizedCause
      });
    } catch {
      return this.writeCollectorOnlyError(severity, sanitized);
    }
    if (!/^[a-f0-9]{64}$/.test(fingerprintSha256)) {
      return this.writeCollectorOnlyError(severity, sanitized);
    }
    const record: ErrorOperationalLogRecord = Object.freeze({
      kind: "error",
      occurredAt: new Date(sanitized.occurredAt.getTime()),
      severity,
      eventKey: sanitized.errorCode,
      summary: sanitized.safeSummary,
      component: sanitized.component,
      correlationId: sanitized.correlationId,
      ...(sanitized.traceId === undefined
        ? {}
        : { traceId: sanitized.traceId }),
      references: sanitized.references,
      ...(sanitized.durationMs === undefined
        ? {}
        : { durationMs: sanitized.durationMs }),
      ...(sanitized.outcome === undefined ? {} : { outcome: sanitized.outcome }),
      attributes: sanitized.attributes,
      fingerprintSha256,
      errorCode: sanitized.errorCode,
      errorClass: sanitized.errorClass,
      ...(sanitized.providerCode === undefined
        ? {}
        : { providerCode: sanitized.providerCode }),
      retryable: sanitized.retryable,
      ...(sanitized.attemptNo === undefined
        ? {}
        : { attemptNo: sanitized.attemptNo }),
      ...(sanitized.redactedStack === undefined
        ? {}
        : { redactedStack: sanitized.redactedStack })
    });
    return this.fanOut(record, this.toPersistentRecord(record));
  }

  private async writeCollectorOnlyError(
    severity: "error" | "fatal",
    sanitized: NonNullable<ReturnType<typeof sanitizeErrorInput>>
  ): Promise<OperationalLogWriteResult> {
    const record: CollectorErrorOperationalLogRecord = Object.freeze({
      kind: "collector_error",
      occurredAt: new Date(sanitized.occurredAt.getTime()),
      severity,
      eventKey: sanitized.errorCode,
      summary: sanitized.safeSummary,
      component: sanitized.component,
      correlationId: sanitized.correlationId,
      ...(sanitized.traceId === undefined
        ? {}
        : { traceId: sanitized.traceId }),
      references: sanitized.references,
      ...(sanitized.durationMs === undefined
        ? {}
        : { durationMs: sanitized.durationMs }),
      ...(sanitized.outcome === undefined ? {} : { outcome: sanitized.outcome }),
      attributes: sanitized.attributes,
      errorCode: sanitized.errorCode,
      errorClass: sanitized.errorClass,
      ...(sanitized.providerCode === undefined
        ? {}
        : { providerCode: sanitized.providerCode }),
      retryable: sanitized.retryable,
      ...(sanitized.attemptNo === undefined
        ? {}
        : { attemptNo: sanitized.attemptNo }),
      ...(sanitized.redactedStack === undefined
        ? {}
        : { redactedStack: sanitized.redactedStack })
    });
    const result = await this.fanOut(record, null);
    return Object.freeze({ ...result, rejectionCode: "FINGERPRINT_FAILED" });
  }

  private toPersistentRecord(
    record: MilestoneOperationalLogRecord | ErrorOperationalLogRecord
  ): PersistentOperationalLogRecord {
    const common = {
      occurredAt: new Date(record.occurredAt.getTime()),
      severity: record.severity,
      eventKey: record.eventKey,
      summary: record.summary,
      component: record.component,
      correlationId: record.correlationId,
      ...(record.traceId === undefined ? {} : { traceId: record.traceId }),
      references: record.references,
      ...(record.durationMs === undefined
        ? {}
        : { durationMs: record.durationMs }),
      ...(record.outcome === undefined ? {} : { outcome: record.outcome })
    };
    if (record.kind === "milestone") {
      return Object.freeze({
        kind: "persistent_milestone",
        ...common,
        category: record.category
      });
    }
    return Object.freeze({
      kind: "persistent_error",
      ...common,
      severity: record.severity,
      fingerprintSha256: record.fingerprintSha256,
      errorCode: record.errorCode,
      errorClass: record.errorClass,
      ...(record.providerCode === undefined
        ? {}
        : { providerCode: record.providerCode }),
      retryable: record.retryable,
      ...(record.attemptNo === undefined ? {} : { attemptNo: record.attemptNo }),
      ...(record.redactedStack === undefined
        ? {}
        : { redactedStack: record.redactedStack })
    });
  }

  private async fanOut(
    record: OperationalLogRecord,
    persistentRecord: PersistentOperationalLogRecord | null
  ): Promise<OperationalLogWriteResult> {
    const targets = [
      ...this.collectorSinks.map((sink) => ({
        sink,
        write: async (): Promise<void> => sink.write(record)
      })),
      ...(persistentRecord === null
        ? []
        : this.persistentSinks.map((sink) => ({
            sink,
            write: async (): Promise<void> => sink.write(persistentRecord)
          })))
    ];
    const settled = await Promise.allSettled(
      targets.map(async (target) => {
        await target.write();
        return target.sink.key;
      })
    );
    const failures: OperationalLogSinkFailure[] = [];
    for (let index = 0; index < settled.length; index += 1) {
      if (settled[index]?.status !== "rejected") {
        continue;
      }
      const target = targets[index];
      if (target === undefined) {
        continue;
      }
      const failure = Object.freeze({
        sinkKey: target.sink.key,
        code: "SINK_WRITE_FAILED" as const
      });
      failures.push(failure);
      try {
        if (
          this.options.fallback !== undefined &&
          this.options.fallback.key !== target.sink.key
        ) {
          this.options.fallback.reportSinkFailure(failure, record);
        }
      } catch {
        // Logging failures are isolated deliberately; no recursive logging.
      }
    }
    return Object.freeze({
      accepted: true,
      attemptedSinkCount: targets.length,
      succeededSinkCount: targets.length - failures.length,
      failureCount: failures.length,
      failures: Object.freeze(failures)
    });
  }
}
