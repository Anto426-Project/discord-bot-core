import { createHash } from "node:crypto";

import type {
  OperationalErrorFingerprintInput,
  OperationalErrorFingerprintPort
} from "./OperationalLogTypes.js";

export class Sha256OperationalErrorFingerprint
  implements OperationalErrorFingerprintPort
{
  public fingerprint(input: OperationalErrorFingerprintInput): string {
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
