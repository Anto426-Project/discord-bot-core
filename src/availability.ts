export type DiscordRuntimeAvailability = "starting" | "ready" | "degraded" | "stopping";

const CAUSE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const MAX_DEGRADATION_CAUSES = 32;

export class DiscordRuntimeAvailabilityTracker {
  private lifecycle: "starting" | "active" | "stopping" = "starting";
  private gatewayDegraded = false;
  private readonly degradationCauses = new Set<string>();

  public current(): DiscordRuntimeAvailability {
    if (this.lifecycle === "stopping") return "stopping";
    if (this.gatewayDegraded || this.degradationCauses.size > 0) return "degraded";
    return this.lifecycle === "starting" ? "starting" : "ready";
  }

  public degradeGateway(): boolean {
    if (this.lifecycle === "stopping") return false;
    const changed = !this.gatewayDegraded;
    this.gatewayDegraded = true;
    return changed;
  }

  public recoverGateway(): boolean {
    if (this.lifecycle === "stopping") return false;
    const changed = this.gatewayDegraded;
    this.gatewayDegraded = false;
    return changed;
  }

  public isGatewayDegraded(): boolean {
    return this.gatewayDegraded;
  }

  public setSynchronizationDegraded(degraded: boolean): void {
    this.setSynchronizationCause("aggregate", degraded);
  }

  public setSynchronizationCause(cause: string, degraded: boolean): void {
    const normalized = cause.trim();
    if (!CAUSE_PATTERN.test(normalized)) {
      throw new TypeError("Discord degradation cause must be a stable lowercase identifier.");
    }
    if (this.lifecycle === "stopping") return;
    if (degraded) {
      if (!this.degradationCauses.has(normalized) && this.degradationCauses.size >= MAX_DEGRADATION_CAUSES) {
        throw new RangeError("Discord degradation cause limit exceeded.");
      }
      this.degradationCauses.add(normalized);
    } else {
      this.degradationCauses.delete(normalized);
    }
  }

  public causes(): readonly string[] {
    return Object.freeze([...this.degradationCauses].sort());
  }

  public markActive(): void {
    if (this.lifecycle !== "stopping") this.lifecycle = "active";
  }

  public markStopping(): void {
    this.lifecycle = "stopping";
  }
}
