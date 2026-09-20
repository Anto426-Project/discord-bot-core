import { createHash } from "node:crypto";
export class Sha256OperationalErrorFingerprint {
    fingerprint(input) {
        const canonical = JSON.stringify([
            input.errorCode,
            input.errorClass,
            input.component,
            input.providerCode,
            input.normalizedCause
        ]);
        return createHash("sha256").update(canonical).digest("hex");
    }
}
//# sourceMappingURL=Sha256OperationalErrorFingerprint.js.map