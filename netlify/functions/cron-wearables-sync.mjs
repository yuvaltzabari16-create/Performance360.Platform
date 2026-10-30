// Daily WHOOP sync on Netlify (same route as vercel.json). The route does nothing until WHOOP_LIVE=1 and the keys are set.
const run = async () => {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return new Response("Skipped: URL or CRON_SECRET missing");
  const res = await fetch(`${site}/api/cron/wearables-sync`, { headers: { Authorization: `Bearer ${secret}` } });
  return new Response(`wearables-sync: ${res.status}`);
};

export default run;

export const config = { schedule: "0 4 * * *" };
