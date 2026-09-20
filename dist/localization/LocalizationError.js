export class LocalizationError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.name = "LocalizationError";
        this.details =
            details === undefined ? undefined : Object.freeze({ ...details });
    }
}
//# sourceMappingURL=LocalizationError.js.map