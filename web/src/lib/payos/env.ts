/**
 * Every payOS secret is read through this one function, by key, never as a literal
 * `process.env.PAYOS_*` expression. Next inlines literal `process.env.X` at build time; the
 * build machine has no credentials, so an inlined read compiles to `undefined` and the webhook
 * answers 503 forever. Dynamic access survives the build.
 */
export const payosEnv = (key: string): string | undefined => process.env[key];
