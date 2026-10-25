import { describe, expect, it } from "vitest";
import { embedUrl, youtubeInfo, youtubeThumbnail } from "./catalog";

describe("youtube helpers", () => {
  it("parses watch, shorts and youtu.be links with start times", () => {
    expect(youtubeInfo("https://www.youtube.com/watch?v=LYtagQH6P5k&pp=abc")).toEqual({ id: "LYtagQH6P5k", start: null, isShort: false });
    expect(youtubeInfo("https://www.youtube.com/watch?v=kF_CyoZihCE&t=115s")?.start).toBe(115);
    expect(youtubeInfo("https://www.youtube.com/shorts/hL82TgLzpxg")).toEqual({ id: "hL82TgLzpxg", start: null, isShort: true });
    expect(youtubeInfo("https://youtu.be/abcdefghijk")?.id).toBe("abcdefghijk");
    expect(youtubeInfo("http://www.youtube.com/watch?v=LYtagQH6P5k")).toBeNull();
    expect(youtubeInfo("https://evil.com/watch?v=LYtagQH6P5k")).toBeNull();
  });
  it("builds privacy-friendly embeds and thumbnails", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=kF_CyoZihCE&t=115s")?.src).toBe("https://www.youtube-nocookie.com/embed/kF_CyoZihCE?rel=0&playsinline=1&start=115");
    expect(embedUrl("https://www.youtube.com/shorts/hL82TgLzpxg", { autoplay: true })).toMatchObject({ kind: "iframe", vertical: true, src: expect.stringContaining("autoplay=1") });
    expect(youtubeThumbnail("https://www.youtube.com/watch?v=LYtagQH6P5k")).toBe("https://i.ytimg.com/vi/LYtagQH6P5k/hqdefault.jpg");
  });
  it("builds a learning embed with captions, loop and speed control", () => {
    const src = embedUrl("https://www.youtube.com/watch?v=LYtagQH6P5k", { learn: true })?.src ?? "";
    for (const p of ["cc_load_policy=1", "loop=1", "playlist=LYtagQH6P5k", "enablejsapi=1", "iv_load_policy=3"]) expect(src).toContain(p);
    expect(embedUrl("https://www.youtube.com/watch?v=LYtagQH6P5k", { autoplay: true })?.src).toContain("mute=1");
  });
  it("handles vimeo, direct files and rejects non-https", () => {
    expect(embedUrl("https://vimeo.com/12345")?.src).toBe("https://player.vimeo.com/video/12345");
    expect(embedUrl("https://cdn.example.com/a.mp4")?.kind).toBe("video");
    expect(embedUrl("http://example.com/a.mp4")).toBeNull();
    expect(embedUrl("javascript:alert(1)")).toBeNull();
  });
});
