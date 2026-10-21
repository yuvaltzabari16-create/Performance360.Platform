/** True only in the self-contained demo build (published as a Claude artifact). */
export const DEMO = import.meta.env.VITE_DEMO === "1";

export const ytWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
