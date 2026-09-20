const positiveInteger = (value, label, maximum) => {
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
        throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
    }
    return value;
};
const waitFor = (milliseconds, signal) => new Promise((resolve) => {
    if (signal.aborted) {
        resolve();
        return;
    }
    const onAbort = () => {
        clearTimeout(timer);
        resolve();
    };
    const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
});
/**
 * Owns one bounded, non-overlapping polling loop around the durable worker.
 * Stop aborts provider work and then drains the active claim before resolving.
 */
export class PollingSupervisor {
    worker;
    options;
    maximumActionsPerDrain;
    idlePollIntervalMs;
    failurePollIntervalMs;
    controller = null;
    activeLoop = null;
    constructor(worker, options) {
        this.worker = worker;
        this.options = options;
        this.maximumActionsPerDrain = positiveInteger(options.maximumActionsPerDrain, "Polling maximum actions per drain", 1_000);
        this.idlePollIntervalMs = positiveInteger(options.idlePollIntervalMs, "Polling idle poll interval", 2_147_483_647);
        this.failurePollIntervalMs = positiveInteger(options.failurePollIntervalMs, "Polling failure poll interval", 2_147_483_647);
    }
    start() {
        if (this.activeLoop !== null)
            return;
        const controller = new AbortController();
        this.controller = controller;
        const activeLoop = this.run(controller.signal).finally(() => {
            if (this.activeLoop === activeLoop) {
                this.activeLoop = null;
                this.controller = null;
            }
        });
        this.activeLoop = activeLoop;
    }
    async stop() {
        const activeLoop = this.activeLoop;
        if (activeLoop === null)
            return;
        this.controller?.abort();
        await activeLoop;
    }
    isRunning() {
        return this.activeLoop !== null;
    }
    async run(signal) {
        while (!signal.aborted) {
            let delayMs = this.idlePollIntervalMs;
            try {
                const outcome = await this.drain(signal);
                if (outcome === "cancelled")
                    return;
                if (outcome === "bounded") {
                    // Yield without allowing an unbounded hot loop when the queue is full.
                    delayMs = 1;
                }
            }
            catch (error) {
                delayMs = this.failurePollIntervalMs;
                try {
                    await this.options.onError(error);
                }
                catch {
                    // Observability must not terminate the durable worker supervisor.
                }
            }
            await waitFor(delayMs, signal);
        }
    }
    async drain(signal) {
        for (let processedCount = 0; processedCount < this.maximumActionsPerDrain; processedCount += 1) {
            if (signal.aborted)
                return "cancelled";
            const result = await this.worker.runOnce(signal);
            if (result.status === "cancelled")
                return "cancelled";
            if (result.status === "idle" || result.status === "busy") {
                return "idle";
            }
        }
        return "bounded";
    }
}
//# sourceMappingURL=PollingSupervisor.js.map