import { describe, it, expect } from "vitest";
import { buildEpisodeMediaMetadataPayload } from "../apps/desktop/src/renderer/src/widgets/anime-viewer/hooks/useMediaSession";

describe("buildEpisodeMediaMetadataPayload", () => {
  it("formats anime title, episode number, episode title, and cover artwork for OS media flyout", () => {
    const payload = buildEpisodeMediaMetadataPayload({
      animeTitle: "One Piece",
      episodeNumber: 1071,
      episodeTitle: "Luffy Peak Attained!",
      coverUrl: "//cdn.example.com/posters/one-piece.jpg",
    });

    expect(payload).toEqual({
      title: "One Piece",
      artist: "Episode 1071 • Luffy Peak Attained!",
      album: "AutaKimi",
      artwork: [{ src: "https://cdn.example.com/posters/one-piece.jpg" }],
    });
  });

  it("avoids duplicate episode text when episodeTitle matches Episode N", () => {
    const payload = buildEpisodeMediaMetadataPayload({
      animeTitle: "Black Clover",
      episodeNumber: 12,
      episodeTitle: "Episode 12",
      coverUrl: "https://cdn.example.com/posters/bc.png",
    });

    expect(payload.title).toBe("Black Clover");
    expect(payload.artist).toBe("Episode 12");
    expect(payload.artwork).toEqual([
      { src: "https://cdn.example.com/posters/bc.png" },
    ]);
  });

  it("handles missing title or unsupported artwork schemes safely", () => {
    const payload = buildEpisodeMediaMetadataPayload({
      animeTitle: "",
      episodeNumber: undefined,
      episodeTitle: "",
      coverUrl: "javascript:alert(1)",
    });

    expect(payload).toEqual({
      title: "AutaKimi",
      artist: "Watching Now",
      album: "AutaKimi",
      artwork: [],
    });
  });
});
