/**
 * Browser Automation Provider Types
 *
 * Defines centralized enums, abstractions, and interfaces for multi-provider
 * browser execution (Local Playwright and Browserbase).
 */

export enum AutomationProvider {
  LOCAL = "LOCAL",
  BROWSERBASE = "BROWSERBASE",
  AUTO = "AUTO",
}

export enum AutomationPreference {
  AUTO = "AUTO",
  LOCAL_ONLY = "LOCAL_ONLY",
  BROWSERBASE_ONLY = "BROWSERBASE_ONLY",
}

export enum FallbackReason {
  LOCAL_SESSION_FAILED = "LOCAL_SESSION_FAILED",
  LOCAL_NAVIGATION_FAILED = "LOCAL_NAVIGATION_FAILED",
  LOCAL_PAGE_LOAD_FAILED = "LOCAL_PAGE_LOAD_FAILED",
  LOCAL_FORM_DETECTION_FAILED = "LOCAL_FORM_DETECTION_FAILED",
  LOCAL_ELEMENT_INTERACTION_FAILED = "LOCAL_ELEMENT_INTERACTION_FAILED",
  LOCAL_FILE_UPLOAD_FAILED = "LOCAL_FILE_UPLOAD_FAILED",
  LOCAL_BROWSER_CRASHED = "LOCAL_BROWSER_CRASHED",
  LOCAL_UNSUPPORTED_BROWSER_FEATURE = "LOCAL_UNSUPPORTED_BROWSER_FEATURE",

  // High-level category aliases
  TIMEOUT = "TIMEOUT",
  BROWSER_CRASH = "BROWSER_CRASH",
  DOM_FAILURE = "DOM_FAILURE",
  NETWORK_ERROR = "NETWORK_ERROR",
}



/**
 * Normalized Page handle wrapping the underlying automation page.
 * Keeps workflow services (FormDetector, Filler, Submitter) provider-agnostic.
 */
export interface PageHandle {
  readonly rawPage: any;
  url(): string;
  title(): Promise<string>;
}

/**
 * Normalized Browser Session
 */
export interface BrowserSession {
  id: string;
  provider: AutomationProvider;
  browser: any;
  context?: any;
  activePage?: PageHandle;
  createdAt: Date;
  debugUrl?: string;
  replayUrl?: string;
}

/**
 * Element reference or selector target
 */
export type TargetSelector = string | any;

/**
 * Browser Provider Interface
 *
 * Implemented by LocalBrowserProvider and BrowserbaseProvider.
 */
export interface BrowserProvider {
  readonly providerType: AutomationProvider;

  /** Create and initialize a browser session */
  createSession(options?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    sessionTimeoutSeconds?: number;
  }): Promise<BrowserSession>;

  /** Open a page in the session */
  openPage(
    session: BrowserSession,
    url: string,
    options?: {
      waitUntil?: "load" | "domcontentloaded" | "networkidle";
      timeout?: number;
    }
  ): Promise<PageHandle>;

  /** Safely close and cleanup the browser session */
  closeSession(session: BrowserSession): Promise<void>;

  /** Page inspection & interaction methods */
  getCurrentUrl(page: PageHandle): Promise<string>;
  getPageHtml(page: PageHandle): Promise<string>;

  waitForSelector(
    page: PageHandle,
    selector: string,
    options?: { timeout?: number; state?: "attached" | "detached" | "visible" | "hidden" }
  ): Promise<void>;

  waitForTimeout(page: PageHandle, ms: number): Promise<void>;

  evaluate<T = any, R = any>(
    page: PageHandle,
    pageFunction: ((arg: T) => R) | string,
    arg?: T
  ): Promise<R>;

  findElement(page: PageHandle, selector: string): Promise<any | null>;
  findElements(page: PageHandle, selector: string): Promise<any[]>;

  click(page: PageHandle, target: TargetSelector, options?: { timeout?: number }): Promise<void>;
  fill(page: PageHandle, target: TargetSelector, value: string, options?: { timeout?: number }): Promise<void>;
  select(page: PageHandle, target: TargetSelector, value: string, options?: { timeout?: number }): Promise<void>;
  check(page: PageHandle, target: TargetSelector, options?: { timeout?: number }): Promise<void>;

  uploadFile(page: PageHandle, target: TargetSelector, filePath: string): Promise<void>;

  screenshot(page: PageHandle, options?: { fullPage?: boolean }): Promise<string>;
  getConsoleLogs(page: PageHandle): Promise<unknown[]>;
}

/**
 * Application Automation State for Safe Resumes
 */
export interface ApplicationAutomationState {
  application_id: string;
  stage: string;
  platform?: string | null;
  page_url?: string;
  form_schema_id?: string | null;
  current_step?: number;
  completed_fields?: string[];
  pending_fields?: string[];
  missing_fields?: any[];
  provider?: AutomationProvider | string;
  session_id?: string;
  updated_at?: string;
}

/**
 * DB Session Record
 */
export interface AutomationSessionRecord {
  id?: string;
  application_id: string;
  provider: string;
  session_id: string;
  status: "ACTIVE" | "COMPLETED" | "FAILED" | "TERMINATED";
  started_at?: string;
  ended_at?: string | null;
  current_url?: string | null;
  last_activity_at?: string;
  session_metadata?: Record<string, any>;
  error_message?: string | null;
}

/**
 * Observability Metrics
 */
export interface AutomationMetrics {
  totalApplications: number;
  localSuccesses: number;
  localFailures: number;
  browserbaseFallbacks: number;
  browserbaseSuccesses: number;
  browserbaseFailures: number;
  fallbackRate: number;
  localSuccessRate: number;
  browserbaseSuccessRate: number;
  submissionSuccessRate: number;
  captchaRate: number;
  profileMissingRate: number;
  averageLocalDurationMs: number;
  averageBrowserbaseDurationMs: number;
}
