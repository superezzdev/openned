/**
 * Local Playwright Browser Provider
 *
 * Runs browser automation using local Chromium via Playwright.
 */

import { chromium } from "playwright";
import {
  BrowserProvider,
  AutomationProvider,
  BrowserSession,
  PageHandle,
  TargetSelector,
} from "./types";

interface PageLogEntry {
  type: string;
  text: string;
  timestamp: string;
}

export class LocalBrowserProvider implements BrowserProvider {
  public readonly providerType = AutomationProvider.LOCAL;
  private consoleLogsMap = new WeakMap<any, PageLogEntry[]>();

  public async createSession(options?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
  }): Promise<BrowserSession> {
    const sessionId = crypto.randomUUID();
    const browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      userAgent:
        options?.userAgent ||
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      viewport: options?.viewport || { width: 1280, height: 800 },
    });

    const rawPage = await context.newPage();
    const logs: PageLogEntry[] = [];
    this.consoleLogsMap.set(rawPage, logs);

    rawPage.on("console", (msg) => {
      logs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      });
      // Keep last 100 log messages
      if (logs.length > 100) logs.shift();
    });

    const activePage: PageHandle = {
      rawPage,
      url: () => rawPage.url(),
      title: () => rawPage.title(),
    };

    return {
      id: sessionId,
      provider: AutomationProvider.LOCAL,
      browser,
      context,
      activePage,
      createdAt: new Date(),
    };
  }

  public async openPage(
    session: BrowserSession,
    url: string,
    options?: {
      waitUntil?: "load" | "domcontentloaded" | "networkidle";
      timeout?: number;
    }
  ): Promise<PageHandle> {
    let rawPage = session.activePage?.rawPage;
    if (!rawPage || rawPage.isClosed?.()) {
      rawPage = await session.context.newPage();
      const logs: PageLogEntry[] = [];
      this.consoleLogsMap.set(rawPage, logs);
      rawPage.on("console", (msg: any) => {
        logs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString(),
        });
        if (logs.length > 100) logs.shift();
      });
    }

    const waitUntil = options?.waitUntil || "domcontentloaded";
    const timeout = options?.timeout ?? 30000;

    await rawPage.goto(url, { waitUntil, timeout });

    const pageHandle: PageHandle = {
      rawPage,
      url: () => rawPage.url(),
      title: () => rawPage.title(),
    };
    session.activePage = pageHandle;
    return pageHandle;
  }

  public async closeSession(session: BrowserSession): Promise<void> {
    try {
      if (session.context) {
        await session.context.close().catch(() => {});
      }
      if (session.browser) {
        await session.browser.close().catch(() => {});
      }
    } catch {
      // safe cleanup
    }
  }

  public async getCurrentUrl(page: PageHandle): Promise<string> {
    return page.rawPage.url();
  }

  public async getPageHtml(page: PageHandle): Promise<string> {
    return page.rawPage.content();
  }

  public async waitForSelector(
    page: PageHandle,
    selector: string,
    options?: { timeout?: number; state?: "attached" | "detached" | "visible" | "hidden" }
  ): Promise<void> {
    await page.rawPage.waitForSelector(selector, {
      timeout: options?.timeout ?? 10000,
      state: options?.state || "visible",
    });
  }

  public async waitForTimeout(page: PageHandle, ms: number): Promise<void> {
    await page.rawPage.waitForTimeout(ms);
  }

  public async evaluate<T = any, R = any>(
    page: PageHandle,
    pageFunction: ((arg: T) => R) | string,
    arg?: T
  ): Promise<R> {
    return page.rawPage.evaluate(pageFunction as any, arg);
  }

  public async findElement(page: PageHandle, selector: string): Promise<any | null> {
    const loc = page.rawPage.locator(selector).first();
    const count = await loc.count().catch(() => 0);
    return count > 0 ? loc : null;
  }

  public async findElements(page: PageHandle, selector: string): Promise<any[]> {
    const loc = page.rawPage.locator(selector);
    const count = await loc.count().catch(() => 0);
    const results: any[] = [];
    for (let i = 0; i < count; i++) {
      results.push(loc.nth(i));
    }
    return results;
  }

  public async click(
    page: PageHandle,
    target: TargetSelector,
    options?: { timeout?: number }
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    if (typeof target === "string") {
      const loc = page.rawPage.locator(target).first();
      await loc.click({ timeout });
    } else if (target && typeof target.click === "function") {
      await target.click({ timeout });
    } else {
      throw new Error(`Invalid target selector for click: ${String(target)}`);
    }
  }

  public async fill(
    page: PageHandle,
    target: TargetSelector,
    value: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    if (typeof target === "string") {
      const loc = page.rawPage.locator(target).first();
      await loc.fill(value, { timeout });
    } else if (target && typeof target.fill === "function") {
      await target.fill(value, { timeout });
    } else {
      throw new Error(`Invalid target selector for fill: ${String(target)}`);
    }
  }

  public async select(
    page: PageHandle,
    target: TargetSelector,
    value: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    if (typeof target === "string") {
      const loc = page.rawPage.locator(target).first();
      await loc.selectOption(value, { timeout });
    } else if (target && typeof target.selectOption === "function") {
      await target.selectOption(value, { timeout });
    } else {
      throw new Error(`Invalid target selector for select: ${String(target)}`);
    }
  }

  public async check(
    page: PageHandle,
    target: TargetSelector,
    options?: { timeout?: number }
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    if (typeof target === "string") {
      const loc = page.rawPage.locator(target).first();
      await loc.check({ timeout });
    } else if (target && typeof target.check === "function") {
      await target.check({ timeout });
    } else {
      throw new Error(`Invalid target selector for check: ${String(target)}`);
    }
  }

  public async uploadFile(
    page: PageHandle,
    target: TargetSelector,
    filePath: string
  ): Promise<void> {
    if (typeof target === "string") {
      const loc = page.rawPage.locator(target).first();
      await loc.setInputFiles(filePath);
    } else if (target && typeof target.setInputFiles === "function") {
      await target.setInputFiles(filePath);
    } else {
      throw new Error(`Invalid target selector for uploadFile: ${String(target)}`);
    }
  }

  public async screenshot(page: PageHandle, options?: { fullPage?: boolean }): Promise<string> {
    const buffer = await page.rawPage.screenshot({
      fullPage: options?.fullPage ?? false,
      encoding: "base64",
    });
    return buffer as string;
  }

  public async getConsoleLogs(page: PageHandle): Promise<unknown[]> {
    return this.consoleLogsMap.get(page.rawPage) || [];
  }
}
