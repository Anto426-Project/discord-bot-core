import { sanitizeCatalogEntry, sanitizeErrorInput, sanitizeOperationalContext, sanitizeTransientInput } from "./OperationalLogSanitizer.js";
const rejected = (rejectionCode) => Object.freeze({
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
});
const operationalCategories = new Set([
    "lifecycle",
    "workflow",
    "dependency",
    "reconcile",
    "cutover"
]);
export class OperationalLogger {
    options;
    catalog;
    collectorSinks;
    persistentSinks;
    constructor(options) {
        this.options = options;
        const catalog = new Map();
        for (const entry of options.catalog) {
            const sanitized = sanitizeCatalogEntry(entry);
            if (sanitized === null) {
                throw new Error(`Invalid operational milestone '${entry.eventKey}'.`);
            }
            if (!operationalCategories.has(entry.category) ||
                !Object.hasOwn(persistentSeverityRank, entry.defaultSeverity)) {
                throw new Error(`Invalid operational milestone '${entry.eventKey}'.`);
            }
            if (catalog.has(sanitized.eventKey)) {
                throw new Error(`Duplicate operational milestone '${sanitized.eventKey}'.`);
            }
            catalog.set(sanitized.eventKey, Object.freeze({
                eventKey: sanitized.eventKey,
                category: entry.category,
                component: sanitized.component,
                defaultSeverity: entry.defaultSeverity,
                description: sanitized.description
            }));
        }
        const sinkKeys = new Set();
        for (const sink of options.sinks) {
            if (sink.key.trim().length === 0 ||
                sinkKeys.has(sink.key) ||
                (sink.kind !== "collector" && sink.kind !== "persistent")) {
                throw new Error(`Invalid or duplicate operational sink '${sink.key}'.`);
            }
            sinkKeys.add(sink.key);
        }
        this.catalog = catalog;
        this.collectorSinks = Object.freeze(options.sinks.filter((sink) => sink.kind === "collector"));
        this.persistentSinks = Object.freeze(options.sinks.filter((sink) => sink.kind === "persistent"));
    }
    debug(input) {
        return this.writeTransient("debug", input);
    }
    info(input) {
        return this.writeTransient("info", input);
    }
    async milestone(input) {
        const catalogEntry = this.catalog.get(input.eventKey);
        if (catalogEntry === undefined) {
            return rejected("UNKNOWN_MILESTONE");
        }
        let context;
        try {
            context = sanitizeOperationalContext(input, this.options.clock.now());
        }
        catch {
            return rejected("INVALID_LOG_INPUT");
        }
        if (context === null) {
            return rejected("INVALID_LOG_INPUT");
        }
        const record = Object.freeze({
            kind: "milestone",
            ...context,
            occurredAt: new Date(context.occurredAt.getTime()),
            severity: input.severity !== undefined &&
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
    error(input) {
        return this.writeError("error", input);
    }
    fatal(input) {
        return this.writeError("fatal", input);
    }
    async writeTransient(severity, input) {
        let sanitized;
        try {
            sanitized = sanitizeTransientInput(input, this.options.clock.now());
        }
        catch {
            return rejected("INVALID_LOG_INPUT");
        }
        if (sanitized === null) {
            return rejected("INVALID_LOG_INPUT");
        }
        const record = Object.freeze({
            kind: "transient",
            ...sanitized,
            occurredAt: new Date(sanitized.occurredAt.getTime()),
            severity,
            references: sanitized.references,
            attributes: sanitized.attributes
        });
        return this.fanOut(record, null);
    }
    async writeError(severity, input) {
        let sanitized;
        try {
            sanitized = sanitizeErrorInput(input, this.options.clock.now());
        }
        catch {
            return rejected("INVALID_LOG_INPUT");
        }
        if (sanitized === null) {
            return rejected("INVALID_LOG_INPUT");
        }
        let fingerprintSha256;
        try {
            fingerprintSha256 = this.options.fingerprint.fingerprint({
                errorCode: sanitized.errorCode,
                errorClass: sanitized.errorClass,
                component: sanitized.component,
                providerCode: sanitized.providerCode ?? null,
                normalizedCause: sanitized.normalizedCause
            });
        }
        catch {
            return this.writeCollectorOnlyError(severity, sanitized);
        }
        if (!/^[a-f0-9]{64}$/.test(fingerprintSha256)) {
            return this.writeCollectorOnlyError(severity, sanitized);
        }
        const record = Object.freeze({
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
    async writeCollectorOnlyError(severity, sanitized) {
        const record = Object.freeze({
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
    toPersistentRecord(record) {
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
    async fanOut(record, persistentRecord) {
        const targets = [
            ...this.collectorSinks.map((sink) => ({
                sink,
                write: async () => sink.write(record)
            })),
            ...(persistentRecord === null
                ? []
                : this.persistentSinks.map((sink) => ({
                    sink,
                    write: async () => sink.write(persistentRecord)
                })))
        ];
        const settled = await Promise.allSettled(targets.map(async (target) => {
            await target.write();
            return target.sink.key;
        }));
        const failures = [];
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
                code: "SINK_WRITE_FAILED"
            });
            failures.push(failure);
            try {
                if (this.options.fallback !== undefined &&
                    this.options.fallback.key !== target.sink.key) {
                    this.options.fallback.reportSinkFailure(failure, record);
                }
            }
            catch {
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
//# sourceMappingURL=OperationalLogger.js.map