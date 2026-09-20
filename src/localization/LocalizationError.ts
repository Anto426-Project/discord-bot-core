export type LocalizationErrorCode =
  | "LOCALIZATION.INVALID_CATALOG"
  | "LOCALIZATION.INVALID_PARAMETER"
  | "LOCALIZATION.INVALID_TEMPLATE"
  | "LOCALIZATION.MISSING_PARAMETER"
  | "LOCALIZATION.TRANSLATOR_REQUIRED"
  | "LOCALIZATION.UNKNOWN_KEY"
  | "LOCALIZATION.UNSUPPORTED_LOCALE"
  | "LOCALIZATION.UNUSED_PARAMETER";

export class LocalizationError extends Error {
  public readonly details: Readonly<Record<string, unknown>> | undefined;

  public constructor(
    public readonly code: LocalizationErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "LocalizationError";
    this.details =
      details === undefined ? undefined : Object.freeze({ ...details });
  }
}
