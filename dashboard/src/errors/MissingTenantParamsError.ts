// src/errors/MissingTenantParamsError.ts

export class MissingTenantParamsError extends Error {
    constructor(message?: string) {
        super(
            message ??
            "Required tenant parameters (orgSlug and appSlug) are missing. " +
            "Multi-tenant data access must always be scoped to an organization and application."
        );
        this.name = "MissingTenantParamsError";
    }
}
