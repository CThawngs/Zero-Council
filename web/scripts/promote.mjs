/**
 * Promotes one account to admin. The local equivalent of the hand-run SQL in
 * web/supabase/migrations/0002_zc_coupons.sql:
 *
 *   insert into zc_users (email, role) values ('you@example.com', 'admin')
 *   on conflict (email) do nothing;
 *
 * That hand-run step is the trust root: the first admin cannot be made by the admin API, because
 * the admin API only answers to admins. This script exists so the same step is possible against the
 * local file store, not as a shortcut around the rule.
 *
 * Refuses to run when Supabase is configured, because then the SQL above is the real path and a
 * second way to grant admin is a second thing to keep locked down.
 *
 *   node scripts/promote.mjs you@example.com
 */
import { setUserRole, ensureUser } from '../src/lib/store/account.ts';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/promote.mjs <email>');
  process.exit(2);
}
if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error(`That does not look like an email address: ${email}`);
  process.exit(2);
}
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Supabase is configured. Promote through SQL instead:\n' +
      `  insert into zc_users (email, role) values ('${email}', 'admin')\n` +
      '  on conflict (email) do update set role = \'admin\';'
  );
  process.exit(1);
}

await ensureUser(email);
const updated = await setUserRole(email, 'admin');
if (!updated) {
  console.error(`No account for ${email}, and it could not be created.`);
  process.exit(1);
}
console.log(`${updated.email} is now ${updated.role}.`);
