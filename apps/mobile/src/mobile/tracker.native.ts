import { AniListMedia, AniListUser, IpcResult, Tracker } from "@common/types";
import { MobileDB } from "./db.native";

export const ANILIST_CLIENT_ID = "16329";
export const ANILIST_GRAPHQL_ENDPOINT = "https://graphql.anilist.co";
export const ANILIST_OAUTH_URL = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`;

const mediaCache = new Map<number, AniListMedia>();

export function normalizeTrackerRow(row: any): Tracker {
  return {
    mangaId: String(row.mangaId ?? row.manga_id ?? ""),
    provider: (row.provider || "anilist") as Tracker["provider"],
    remoteId: String(row.remoteId ?? row.remote_id ?? ""),
    score:
      row.score !== undefined && row.score !== null
        ? Number(row.score)
        : undefined,
    status: row.status || "CURRENT",
    lastSyncedChapter: Number(
      row.lastSyncedChapter ?? row.last_synced_chapter ?? 0,
    ),
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined,
  };
}

async function queryAniList<T = any>(
  query: string,
  variables: Record<string, any> = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok && response.status !== 400) {
    throw new Error(`AniList HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || "AniList API Error");
  }
  return json.data as T;
}

async function getToken(): Promise<string | null> {
  try {
    const res = await MobileDB.getSetting("anilist_token");
    const val = res.ok ? res.value : null;
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

async function saveToken(token: string): Promise<void> {
  await MobileDB.setSetting("anilist_token", token.trim());
}

async function fetchViewer(token: string): Promise<AniListUser> {
  const query = `
    query {
      Viewer {
        id
        name
        avatar {
          large
          medium
        }
      }
    }
  `;
  const data = await queryAniList<{ Viewer: AniListUser }>(query, {}, token);
  if (!data?.Viewer) {
    throw new Error("Failed to retrieve AniList user profile.");
  }
  return data.Viewer;
}

export const MobileTracker = {
  async setTokenAniList(token: string): Promise<IpcResult<AniListUser>> {
    try {
      const cleanToken = token.trim();
      if (!cleanToken) {
        return { ok: false, error: "Token cannot be empty." };
      }
      const user = await fetchViewer(cleanToken);
      await saveToken(cleanToken);
      await MobileDB.setSetting("anilist_user", JSON.stringify(user));
      return { ok: true, value: user };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || "Failed to authenticate with AniList",
      };
    }
  },

  async getUserAniList(): Promise<IpcResult<AniListUser | null>> {
    try {
      const token = await getToken();
      if (!token) return { ok: true, value: null };

      const cachedRes = await MobileDB.getSetting("anilist_user");
      if (cachedRes.ok && cachedRes.value) {
        try {
          return { ok: true, value: JSON.parse(cachedRes.value) };
        } catch {
          // Fallback to network fetch
        }
      }

      const user = await fetchViewer(token);
      await MobileDB.setSetting("anilist_user", JSON.stringify(user));
      return { ok: true, value: user };
    } catch {
      return { ok: true, value: null };
    }
  },

  async logoutAniList(): Promise<IpcResult<void>> {
    await MobileDB.setSetting("anilist_token", "");
    await MobileDB.setSetting("anilist_user", "");
    return { ok: true, value: undefined };
  },

  async searchAniList(args: {
    query: string;
    type?: "ANIME" | "MANGA";
  }): Promise<IpcResult<AniListMedia[]>> {
    try {
      const query = `
        query ($search: String, $type: MediaType) {
          Page(page: 1, perPage: 15) {
            media(search: $search, type: $type) {
              id
              idMal
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                medium
              }
              type
              format
              status
              episodes
              chapters
            }
          }
        }
      `;
      const data = await queryAniList<{ Page: { media: AniListMedia[] } }>(
        query,
        {
          search: args.query,
          type: args.type || "MANGA",
        },
      );
      const list = data?.Page?.media || [];
      for (const item of list) {
        if (item?.id) mediaCache.set(item.id, item);
      }
      return { ok: true, value: list };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || "Failed to search AniList",
      };
    }
  },

  async getMediaAniList(
    mediaId: number,
  ): Promise<IpcResult<AniListMedia | null>> {
    try {
      const token = await getToken();
      const query = `
        query ($mediaId: Int) {
          Media(id: $mediaId) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            type
            format
            status
            episodes
            chapters
            mediaListEntry {
              id
              status
              score(format: POINT_100)
              progress
            }
          }
        }
      `;
      const data = await queryAniList<{ Media: AniListMedia }>(
        query,
        { mediaId },
        token,
      );
      if (data?.Media) {
        mediaCache.set(mediaId, data.Media);
      }
      return { ok: true, value: data?.Media || null };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || "Failed to load AniList media",
      };
    }
  },

  async resolveSmartStatus(
    mediaId: number,
    targetNumber: number,
    currentStatus?: string,
  ): Promise<string> {
    let resolved = currentStatus || "CURRENT";
    try {
      let media = mediaCache.get(mediaId);
      if (!media) {
        const remote = await this.getMediaAniList(mediaId);
        if (remote.ok && remote.value) {
          media = remote.value;
        }
      }
      const totalCount = media?.chapters || media?.episodes;
      if (totalCount && targetNumber >= totalCount) {
        resolved = "COMPLETED";
      }
    } catch {
      // keep fallback status
    }
    return resolved;
  },

  async updateAniList(args: {
    mediaId: number;
    status?: string;
    progress?: number;
    score?: number;
  }): Promise<IpcResult<any>> {
    try {
      const token = await getToken();
      if (!token) {
        return { ok: false, error: "AniList account is not connected." };
      }

      let finalStatus = args.status;
      if (
        args.progress !== undefined &&
        args.progress > 0 &&
        finalStatus !== "COMPLETED"
      ) {
        finalStatus = await this.resolveSmartStatus(
          args.mediaId,
          args.progress,
          finalStatus,
        );
      }

      const mutation = `
        mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int) {
          SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw) {
            id
            mediaId
            status
            score(format: POINT_100)
            progress
          }
        }
      `;
      const variables: Record<string, any> = { mediaId: args.mediaId };
      if (finalStatus) variables.status = finalStatus;
      if (args.progress !== undefined) variables.progress = args.progress;
      if (args.score !== undefined && args.score !== null && args.score > 0) {
        variables.scoreRaw = args.score;
      }

      const data = await queryAniList<{ SaveMediaListEntry: any }>(
        mutation,
        variables,
        token,
      );
      return { ok: true, value: data?.SaveMediaListEntry };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || "Failed to update AniList entry",
      };
    }
  },

  async autoSyncProgress(
    mangaId: string,
    rawNumber?: number | string,
  ): Promise<void> {
    try {
      const autoMarkRes = await MobileDB.getSetting("auto_mark_read");
      if (autoMarkRes.ok && autoMarkRes.value === "false") return;

      const token = await getToken();
      if (!token) return;

      const trackerRes = await MobileDB.getTrackers(mangaId);
      if (!trackerRes.ok || !Array.isArray(trackerRes.value)) return;
      const rawAnilist = trackerRes.value.find(
        (t: any) => t.provider === "anilist",
      );
      if (!rawAnilist) return;

      const tracker = normalizeTrackerRow(rawAnilist);
      const remoteMediaId = Number.parseInt(tracker.remoteId, 10);
      if (!Number.isFinite(remoteMediaId) || remoteMediaId <= 0) return;

      const parsedNum = Number.parseFloat(String(rawNumber ?? ""));
      if (!Number.isFinite(parsedNum) || parsedNum <= 0) return;
      const targetNumber = Math.floor(parsedNum);
      if (targetNumber <= (tracker.lastSyncedChapter || 0)) return;

      const res = await this.updateAniList({
        mediaId: remoteMediaId,
        status: tracker.status || "CURRENT",
        progress: targetNumber,
        score: tracker.score && tracker.score > 0 ? tracker.score : undefined,
      });

      if (res.ok) {
        await MobileDB.saveTracker({
          mangaId,
          provider: "anilist",
          remoteId: tracker.remoteId,
          status: res.value?.status || tracker.status || "CURRENT",
          score: tracker.score,
          lastSyncedChapter: targetNumber,
        });
      }
    } catch (err) {
      console.warn("[MobileTracker] Auto-sync failed:", err);
    }
  },
};
