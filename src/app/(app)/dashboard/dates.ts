/** ISO date (YYYY-MM-DD) n days before today. */
export const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
