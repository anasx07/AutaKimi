import { describe, it, expect } from "vitest";
import {
  buildDiscordActivity,
  formatDiscordDuration,
  sanitizeDiscordText,
} from "@common/utils/discordPresence";
import {
  decodeDiscordRpcFrames,
  DISCORD_IPC_OPCODES,
  encodeDiscordRpcFrame,
  getDiscordIpcEndpoints,
} from "../apps/desktop/src/main/utils/discordIpcFrame";
import { SettingsMapper } from "../apps/desktop/src/renderer/src/shared/lib/settings.mapper";

describe("Discord Rich Presence", () => {
  it("formats anime watching activity with episode label, timestamps, and cover artwork", () => {
    const nowMs = 1_700_000_000_000;
    const playing = buildDiscordActivity(
      {
        kind: "anime",
        title: "Solo Leveling",
        chapterOrEpisode: 4,
        coverUrl: "https://cdn.example.com/solo.jpg",
        currentTimeSeconds: 252,
        durationSeconds: 1420,
        isPaused: false,
      },
      nowMs,
    );

    expect(playing).toMatchObject({
      type: 3,
      details: "Watching Solo Leveling • Ep 4",
      state: "AutaKimi • 04:12 / 23:40",
      assets: {
        large_image: "https://cdn.example.com/solo.jpg",
        large_text: "Solo Leveling",
      },
    });
    expect(playing?.timestamps?.start).toBe(
      Math.floor((nowMs - 252_000) / 1000),
    );
    expect(playing?.timestamps?.end).toBe(
      (playing?.timestamps?.start ?? 0) + 1420,
    );

    const paused = buildDiscordActivity(
      {
        kind: "anime",
        title: "Solo Leveling",
        chapterOrEpisode: 4,
        currentTimeSeconds: 252,
        durationSeconds: 1420,
        isPaused: true,
      },
      nowMs,
    );
    expect(paused?.state).toBe("Paused • 04:12 / 23:40");
    expect(paused?.timestamps).toBeUndefined();
  });

  it("formats manga reading activity with chapter number, page progress, and elapsed start", () => {
    const nowMs = 1_700_000_000_000;
    const reading = buildDiscordActivity(
      {
        kind: "manga",
        title: "Vagabond",
        chapterOrEpisode: 120,
        coverUrl: "//cdn.example.com/vagabond.jpg",
        page: 14,
        totalPages: 32,
      },
      nowMs,
    );

    expect(reading).toMatchObject({
      type: 0,
      details: "Reading Vagabond • Ch 120",
      state: "Page 14 / 32",
      timestamps: { start: 1_700_000_000 },
      assets: {
        large_image: "https://cdn.example.com/vagabond.jpg",
        large_text: "Vagabond",
      },
    });
  });

  it("clears activity when idle, skips local cache URLs, and truncates long text cleanly", () => {
    expect(buildDiscordActivity({ kind: "idle" })).toBeNull();

    const localCover = buildDiscordActivity({
      kind: "manga",
      title: "A".repeat(160),
      chapterOrEpisode: 1,
      coverUrl: "autakimi-cache://local.png",
    });
    expect(localCover?.details.length).toBeLessThanOrEqual(128);
    expect(localCover?.details.endsWith("...")).toBe(true);
    expect(localCover?.assets).toBeUndefined();
    expect(formatDiscordDuration(3725)).toBe("1:02:05");
    expect(sanitizeDiscordText("  hello   world  ")).toBe("hello world");
  });

  it("encodes and decodes binary Discord IPC frames including split buffers", () => {
    const frame1 = encodeDiscordRpcFrame(DISCORD_IPC_OPCODES.HANDSHAKE, {
      v: 1,
      client_id: "123",
    });
    const frame2 = encodeDiscordRpcFrame(DISCORD_IPC_OPCODES.FRAME, {
      cmd: "SET_ACTIVITY",
      ok: true,
    });
    const combined = Buffer.concat([frame1, frame2]);

    // Split right in the middle of frame2 header to verify streaming reassembly
    const partA = combined.subarray(0, frame1.length + 4);
    const partB = combined.subarray(frame1.length + 4);

    const firstPass = decodeDiscordRpcFrames(partA);
    expect(firstPass.frames).toEqual([
      {
        opcode: DISCORD_IPC_OPCODES.HANDSHAKE,
        data: { v: 1, client_id: "123" },
      },
    ]);
    expect(firstPass.remainder.length).toBe(4);

    const secondPass = decodeDiscordRpcFrames(
      Buffer.concat([firstPass.remainder, partB]),
    );
    expect(secondPass.frames).toEqual([
      {
        opcode: DISCORD_IPC_OPCODES.FRAME,
        data: { cmd: "SET_ACTIVITY", ok: true },
      },
    ]);
    expect(secondPass.remainder.length).toBe(0);
  });

  it("resolves platform Discord IPC endpoints and maps persisted settings cleanly", () => {
    const winEndpoints = getDiscordIpcEndpoints("win32", {});
    expect(winEndpoints[0]).toBe("\\\\?\\pipe\\discord-ipc-0");
    expect(winEndpoints).toHaveLength(10);

    const linuxEndpoints = getDiscordIpcEndpoints("linux", {
      XDG_RUNTIME_DIR: "/run/user/1000",
    });
    expect(linuxEndpoints).toContain("/run/user/1000/discord-ipc-0");
    expect(linuxEndpoints).toContain(
      "/run/user/1000/app/com.discordapp.Discord/discord-ipc-0",
    );

    const schema = SettingsMapper.toSchema({
      discord_rpc_enabled: "true",
      discord_rpc_client_id: "123456789012345678",
    });
    expect(schema.app.discordRpcEnabled).toBe(true);
    expect(schema.app.discordRpcClientId).toBe("123456789012345678");
  });
});
