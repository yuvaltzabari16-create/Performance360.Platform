// Netlify has no vercel.json cron: this scheduled function calls the same route once a day.
// Needs CRON_SECRET (and the service-role key, used by the route itself). Does nothing without the secret.
const run = async () => {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return new Response("Skipped: URL or CRON_SECRET missing");
  const res = await fetch(`${site}/api/cron/notification-emails`, { headers: { Authorization: `Bearer ${secret}` } });
  return new Response(`notification-emails: ${res.status}`);
};

export default run;

export const config = { schedule: "0 6 * * *" };
