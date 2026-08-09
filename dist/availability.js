const CAUSE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const MAX_DEGRADATION_CAUSES = 32;
export class DiscordRuntimeAvailabilityTracker {
    lifecycle = "starting";
    gatewayDegraded = false;
    degradationCauses = new Set();
    current() {
        if (this.lifecycle === "stopping")
            return "stopping";
        if (this.gatewayDegraded || this.degradationCauses.size > 0)
            return "degraded";
        return this.lifecycle === "starting" ? "starting" : "ready";
    }
    degradeGateway() {
        if (this.lifecycle === "stopping")
            return false;
        const changed = !this.gatewayDegraded;
        this.gatewayDegraded = true;
        return changed;
    }
    recoverGateway() {
        if (this.lifecycle === "stopping")
            return false;
        const changed = this.gatewayDegraded;
        this.gatewayDegraded = false;
        return changed;
    }
    isGatewayDegraded() {
        return this.gatewayDegraded;
    }
    setSynchronizationDegraded(degraded) {
        this.setSynchronizationCause("aggregate", degraded);
    }
    setSynchronizationCause(cause, degraded) {
        const normalized = cause.trim();
        if (!CAUSE_PATTERN.test(normalized)) {
            throw new TypeError("Discord degradation cause must be a stable lowercase identifier.");
        }
        if (this.lifecycle === "stopping")
            return;
        if (degraded) {
            if (!this.degradationCauses.has(normalized) && this.degradationCauses.size >= MAX_DEGRADATION_CAUSES) {
                throw new RangeError("Discord degradation cause limit exceeded.");
            }
            this.degradationCauses.add(normalized);
        }
        else {
            this.degradationCauses.delete(normalized);
        }
    }
    causes() {
        return Object.freeze([...this.degradationCauses].sort());
    }
    markActive() {
        if (this.lifecycle !== "stopping")
            this.lifecycle = "active";
    }
    markStopping() {
        this.lifecycle = "stopping";
    }
}
//# sourceMappingURL=availability.js.map