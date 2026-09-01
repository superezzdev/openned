/**
 * Dedicated Browserbase Service
 *
 * Manages Browserbase sessions, CDP connection URLs, live debugging links,
 * and session lifecycle cleanup.
 *
 * Enforces concurrency limits using browserbaseLimiter.
 */

import fs from "fs";
import path from "path";
import { browserbaseLimiter } from "./concurrency-limiter";

export interface BrowserbaseSessionInfo {
  id: string;
  connectUrl: string;
  projectId?: string;
  createdAt: string;
  status: string;
}

export class BrowserbaseService {
  private apiKey: string;
  private defaultProjectId?: string;
  private client: any = null;

  constructor() {
    this.apiKey = this.resolveApiKey();
    this.defaultProjectId = process.env.BROWSERBASE_PROJECT_ID || undefined;
  }

  private resolveApiKey(): string {
    if (process.env.BROWSERBASE_API_KEY) {
      return process.env.BROWSERBASE_API_KEY;
    }
    try {
      const envPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const m = content.match(/BROWSERBASE_API_KEY\s*=\s*([^\r\n]+)/);
        if (m) {
          const key = m[1].trim().replace(/^['"]|['"]$/g, "");
          process.env.BROWSERBASE_API_KEY = key;
          return key;
        }
      }
    } catch {}
    return "";
  }


  public isConfigured(): boolean {
    if (!this.apiKey) {
      this.apiKey = this.resolveApiKey();
    }
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Lazily initialize Browserbase SDK client.
   */
  private async getClient() {
    if (this.client) return this.client;
    if (!this.isConfigured()) {
      throw new Error("BROWSERBASE_API_KEY is not configured in environment variables");
    }


    try {
      // Dynamic import to allow graceful fallback when running in offline/mock test environments
      const sdkModule = await import("@browserbasehq/sdk");
      const BrowserbaseConstructor = (sdkModule as any).default || (sdkModule as any).Browserbase;
      this.client = new BrowserbaseConstructor({
        apiKey: this.apiKey,
      });
      return this.client;
    } catch (err: any) {
      console.error("[BrowserbaseService] Failed to initialize Browserbase SDK:", err?.message);
      throw err;
    }
  }

  /**
   * Create a Browserbase cloud session within the configured concurrency limit.
   */
  public async createSession(options?: {
    projectId?: string;
    keepAlive?: boolean;
    timeout?: number;
    userMetadata?: Record<string, any>;
  }): Promise<BrowserbaseSessionInfo> {
    if (!this.isConfigured()) {
      throw new Error("Cannot create Browserbase session: BROWSERBASE_API_KEY is missing");
    }

    return browserbaseLimiter.run(async () => {
      const client = await this.getClient();
      const projectId = options?.projectId || this.defaultProjectId;

      const sessionPayload: Record<string, any> = {};
      if (projectId) {
        sessionPayload.projectId = projectId;
      }
      if (options?.keepAlive) {
        sessionPayload.keepAlive = options.keepAlive;
      }
      if (options?.timeout) {
        sessionPayload.timeout = options.timeout;
      }

      console.log("[BrowserbaseService] Requesting session creation...", {
        hasProject: Boolean(projectId),
        activeConcurrency: browserbaseLimiter.currentActive,
      });

      const session = await client.sessions.create(sessionPayload);

      return {
        id: session.id,
        connectUrl: session.connectUrl,
        projectId: session.projectId || projectId,
        createdAt: session.createdAt || new Date().toISOString(),
        status: session.status || "RUNNING",
      };
    });
  }

  /**
   * Retrieve live debug and inspector URLs for an active session.
   */
  public async getLiveDebugUrls(sessionId: string): Promise<{ debuggerUrl?: string; wsUrl?: string }> {
    if (!this.isConfigured() || !sessionId) return {};
    try {
      const client = await this.getClient();
      const debugInfo = await client.sessions.debug(sessionId);
      return {
        debuggerUrl: debugInfo?.debuggerUrl || debugInfo?.url,
        wsUrl: debugInfo?.wsUrl,
      };
    } catch (err: any) {
      console.warn("[BrowserbaseService] Could not fetch live debug URL:", err?.message);
      return {};
    }
  }

  /**
   * Get public replay link for a session (safe for authorized admin inspection).
   */
  public getReplayUrl(sessionId: string): string {
    return `https://browserbase.com/sessions/${encodeURIComponent(sessionId)}`;
  }

  /**
   * Safely terminate a Browserbase session.
   */
  public async terminateSession(sessionId: string): Promise<void> {
    if (!this.isConfigured() || !sessionId) return;
    try {
      const client = await this.getClient();
      if (client?.sessions?.update) {
        await client.sessions.update(sessionId, { status: "REQUEST_RELEASE" }).catch(() => {});
      }
    } catch {
      // safe cleanup ignore
    }
  }

  public async closeSession(sessionId: string): Promise<void> {
    return this.terminateSession(sessionId);
  }

}

export const browserbaseService = new BrowserbaseService();
