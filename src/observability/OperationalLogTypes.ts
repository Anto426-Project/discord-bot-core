export type OperationalLogSeverity =
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";

export type PersistentOperationalLogSeverity = Exclude<
  OperationalLogSeverity,
  "debug"
>;

export type OperationalLogCategory =
  | "lifecycle"
  | "workflow"
  | "dependency"
  | "reconcile"
  | "cutover";

export type OperationalLogOutcome =
  | "ok"
  | "degraded"
  | "failed"
  | "recovered";

export type OperationalLogPrimitive = string | number | boolean | null;

export type OperationalLogReferences = Readonly<{
  guildId?: string;
  principalId?: string;
  operationId?: string;
  jobRunId?: string;
}>;

export type OperationalLogContextInput = Readonly<{
  correlationId: string;
  traceId?: string;
  references?: OperationalLogReferences;
  durationMs?: number;
  outcome?: OperationalLogOutcome;
  attributes?: Readonly<Record<string, OperationalLogPrimitive>>;
  occurredAt?: Date;
}>;

export type TransientOperationalLogInput = OperationalLogContextInput &
  Readonly<{
    eventKey: string;
    component: string;
    summary: string;
  }>;

export type MilestoneOperationalLogInput = OperationalLogContextInput &
  Readonly<{
    eventKey: string;
    severity?: PersistentOperationalLogSeverity;
  }>;

export type ErrorOperationalLogInput = OperationalLogContextInput &
  Readonly<{
    errorCode: string;
    component: string;
    safeSummary: string;
    error?: unknown;
    errorClass?: string;
    providerCode?: string;
    retryable: boolean;
    attemptNo?: number;
  }>;

export type OperationalMilestoneCatalogEntry = Readonly<{
  eventKey: string;
  category: OperationalLogCategory;
  component: string;
  defaultSeverity: PersistentOperationalLogSeverity;
  description: string;
}>;

type CommonOperationalLogRecord = Readonly<{
  occurredAt: Date;
  severity: OperationalLogSeverity;
  eventKey: string;
  summary: string;
  component: string;
  correlationId: string;
  traceId?: string;
  references: OperationalLogReferences;
  durationMs?: number;
  outcome?: OperationalLogOutcome;
  attributes: Readonly<Record<string, OperationalLogPrimitive>>;
}>;

export type TransientOperationalLogRecord = CommonOperationalLogRecord &
  Readonly<{
    kind: "transient";
    severity: "debug" | "info";
  }>;

export type MilestoneOperationalLogRecord = CommonOperationalLogRecord &
  Readonly<{
    kind: "milestone";
    severity: PersistentOperationalLogSeverity;
    category: OperationalLogCategory;
  }>;

export type ErrorOperationalLogRecord = CommonOperationalLogRecord &
  Readonly<{
    kind: "error";
    severity: "error" | "fatal";
    fingerprintSha256: string;
    errorCode: string;
    errorClass: string;
    providerCode?: string;
    retryable: boolean;
    attemptNo?: number;
    redactedStack?: string;
  }>;

export type CollectorErrorOperationalLogRecord = CommonOperationalLogRecord &
  Readonly<{
    kind: "collector_error";
    severity: "error" | "fatal";
    errorCode: string;
    errorClass: string;
    providerCode?: string;
    retryable: boolean;
    attemptNo?: number;
    redactedStack?: string;
  }>;

type CommonPersistentOperationalLogRecord = Readonly<{
  occurredAt: Date;
  severity: PersistentOperationalLogSeverity;
  eventKey: string;
  summary: string;
  component: string;
  correlationId: string;
  traceId?: string;
  references: OperationalLogReferences;
  durationMs?: number;
  outcome?: OperationalLogOutcome;
}>;

export type PersistentMilestoneOperationalLogRecord =
  CommonPersistentOperationalLogRecord &
    Readonly<{
      kind: "persistent_milestone";
      category: OperationalLogCategory;
    }>;

export type PersistentErrorOperationalLogRecord =
  CommonPersistentOperationalLogRecord &
    Readonly<{
      kind: "persistent_error";
      severity: "error" | "fatal";
      fingerprintSha256: string;
      errorCode: string;
      errorClass: string;
      providerCode?: string;
      retryable: boolean;
      attemptNo?: number;
      redactedStack?: string;
    }>;

export type OperationalLogRecord =
  | TransientOperationalLogRecord
  | MilestoneOperationalLogRecord
  | CollectorErrorOperationalLogRecord
  | ErrorOperationalLogRecord
  | PersistentMilestoneOperationalLogRecord
  | PersistentErrorOperationalLogRecord;

export type PersistentOperationalLogRecord =
  | PersistentMilestoneOperationalLogRecord
  | PersistentErrorOperationalLogRecord;

export type OperationalLogSinkKind = "collector" | "persistent";

export interface OperationalLogSink {
  readonly key: string;
  readonly kind: OperationalLogSinkKind;
  write(record: OperationalLogRecord): Promise<void>;
}

export type OperationalLogSinkFailure = Readonly<{
  sinkKey: string;
  code: "SINK_WRITE_FAILED";
}>;

export interface OperationalLogFallback {
  readonly key: string;
  reportSinkFailure(
    failure: OperationalLogSinkFailure,
    record: OperationalLogRecord
  ): void;
}

export type OperationalLogWriteResult = Readonly<{
  accepted: boolean;
  attemptedSinkCount: number;
  succeededSinkCount: number;
  failureCount: number;
  failures: readonly OperationalLogSinkFailure[];
  rejectionCode?:
    | "UNKNOWN_MILESTONE"
    | "INVALID_LOG_INPUT"
    | "FINGERPRINT_FAILED";
}>;

export type OperationalErrorFingerprintInput = Readonly<{
  errorCode: string;
  errorClass: string;
  component: string;
  providerCode: string | null;
  normalizedCause: string;
}>;

export interface OperationalErrorFingerprintPort {
  fingerprint(input: OperationalErrorFingerprintInput): string;
}
