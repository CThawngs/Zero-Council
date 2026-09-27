/**
 * Every server secret is read through this one function, by key, never as a literal
 * `process.env.SOMETHING` expression. Next inlines literal `process.env.X` at build time; the
 * build machine has no credentials, so an inlined read compiles to `undefined` and the webhook
 * answered 503 forever. Dynamic access survives the build.
 *
 * Server-only: the callers run inside route handlers, so these values never reach the client
 * bundle. Do not import this from a client component.
 */
export const serverEnv = (key: string): string | undefined => process.env[key];
