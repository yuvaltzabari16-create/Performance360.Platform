import { describe, expect, it } from "vitest";
import { embedUrl } from "./catalog";

describe("embedUrl", () => {
  it("embeds youtube and vimeo with privacy-friendly hosts", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=abc123")).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/abc123" });
    expect(embedUrl("https://youtu.be/xyz")?.src).toBe("https://www.youtube-nocookie.com/embed/xyz");
    expect(embedUrl("https://vimeo.com/12345")?.src).toBe("https://player.vimeo.com/video/12345");
  });
  it("handles direct files and rejects non-https", () => {
    expect(embedUrl("https://cdn.example.com/a.mp4")?.kind).toBe("video");
    expect(embedUrl("http://example.com/a.mp4")).toBeNull();
    expect(embedUrl("javascript:alert(1)")).toBeNull();
  });
});
