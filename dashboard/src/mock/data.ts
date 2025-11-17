export function getAppsForOrg(orgSlug: string) {
    return [
        { appSlug: "myapp", name: "My Application" },
        { appSlug: "billing", name: "Billing Service" },
        { appSlug: "portal", name: "Customer Portal" },
    ];
}
