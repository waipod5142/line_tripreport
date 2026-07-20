import "server-only";

// Thin LINE Messaging API client. Only the calls the ingestion + attachment
// pipeline needs. The access token is server-only.

const API = "https://api.line.me/v2/bot";
const API_DATA = "https://api-data.line.me/v2/bot";

export interface LineProfile {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
}

export interface LineGroupSummary {
  groupId: string;
  groupName?: string;
  pictureUrl?: string;
}

export interface LineContent {
  data: ArrayBuffer;
  contentType: string | null;
}

export class LineClient {
  constructor(private readonly accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN) {}

  private headers() {
    if (!this.accessToken) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  /** Download ephemeral message content (image/file/video/audio). */
  async getContent(messageId: string): Promise<LineContent> {
    const res = await fetch(`${API_DATA}/message/${messageId}/content`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`LINE getContent ${messageId} failed: ${res.status}`);
    }
    return {
      data: await res.arrayBuffer(),
      contentType: res.headers.get("content-type"),
    };
  }

  async getGroupSummary(groupId: string): Promise<LineGroupSummary | null> {
    const res = await fetch(`${API}/group/${groupId}/summary`, {
      headers: this.headers(),
    });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) throw new Error(`LINE getGroupSummary failed: ${res.status}`);
    return res.json();
  }

  async getGroupMemberProfile(
    groupId: string,
    userId: string,
  ): Promise<LineProfile | null> {
    const res = await fetch(`${API}/group/${groupId}/member/${userId}`, {
      headers: this.headers(),
    });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) {
      throw new Error(`LINE getGroupMemberProfile failed: ${res.status}`);
    }
    return res.json();
  }

  async getProfile(userId: string): Promise<LineProfile | null> {
    const res = await fetch(`${API}/profile/${userId}`, {
      headers: this.headers(),
    });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) throw new Error(`LINE getProfile failed: ${res.status}`);
    return res.json();
  }
}
