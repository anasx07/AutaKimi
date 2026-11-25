import { describe, it, expect } from "vitest";
import {
  recordLivePlaybackSeconds,
  peekLivePlaybackSeconds,
  consumeLivePlaybackSeconds,
  shouldAutoEnterPip,
} from "../apps/desktop/src/renderer/src/app/components/pipPlayerStore";

describe("pipPlayerStore helpers", () => {
  it("stores and consumes exact playback seconds cleanly across transitions", () => {
    recordLivePlaybackSeconds("anime-42", "ep-3", 147.65);
    expect(peekLivePlaybackSeconds("anime-42", "ep-3")).toBeCloseTo(147.65);

    expect(consumeLivePlaybackSeconds("anime-42", "ep-3")).toBeCloseTo(147.65);
    expect(peekLivePlaybackSeconds("anime-42", "ep-3")).toBe(0);
  });

  it("activates Auto-PiP only when an anime video is actively playing on desktop", () => {
    const baseAnime = {
      id: "anime-1",
      title: "Ninja Kamui",
      url: "https://example.com/nk",
      pkg: "ext.pkg",
      mediaType: "anime" as const,
    };
    const baseEp = {
      id: "ep-1",
      title: "Episode 1",
      url: "https://example.com/ep1",
      number: 1,
    };

    expect(
      shouldAutoEnterPip({
        livePlayback: {
          manga: baseAnime,
          chapter: baseEp,
          pkg: "ext.pkg",
          isPlaying: true,
        },
        hasExistingPip: false,
        isMobileView: false,
      }),
    ).toBe(true);

    // Paused video should NOT trigger Auto-PiP
    expect(
      shouldAutoEnterPip({
        livePlayback: {
          manga: baseAnime,
          chapter: baseEp,
          pkg: "ext.pkg",
          isPlaying: false,
        },
        hasExistingPip: false,
        isMobileView: false,
      }),
    ).toBe(false);

    // Existing PiP or mobile viewport should skip Auto-PiP
    expect(
      shouldAutoEnterPip({
        livePlayback: {
          manga: baseAnime,
          chapter: baseEp,
          pkg: "ext.pkg",
          isPlaying: true,
        },
        hasExistingPip: true,
        isMobileView: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoEnterPip({
        livePlayback: {
          manga: baseAnime,
          chapter: baseEp,
          pkg: "ext.pkg",
          isPlaying: true,
        },
        hasExistingPip: false,
        isMobileView: true,
      }),
    ).toBe(false);
  });
});
