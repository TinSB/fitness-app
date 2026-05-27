/// <reference types="vite/client" />

// Build identifiers injected by vite.config.ts `define`. Read by the sync
// diagnostic surface so the iPhone PWA can prove which build it is running
// — necessary because service-worker cache pinning was a leading suspect
// during the V2 root cause investigation. Both values are short, hex-only
// / ISO-only strings; no secrets, env values, or tokens.
declare const __IRONPATH_BUILD_SHA__: string;
declare const __IRONPATH_BUILD_ISO__: string;
