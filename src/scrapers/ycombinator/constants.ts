export const SOURCE_NAME = "ycombinator" as const;

export const BASE_URL = "https://www.ycombinator.com";
export const JOBS_INDEX_URL = `${BASE_URL}/jobs`;

export const DEFAULT_ROLE_PATHS = [
  "/jobs/role/software-engineer",
  "/jobs/role/software-engineer/remote",
  "/jobs/role/software-engineer/san-francisco",
  "/jobs/role/software-engineer/new-york",
  "/jobs/role/software-engineer/los-angeles",
  "/jobs/role/product-manager",
  "/jobs/role/product-manager/remote",
  "/jobs/role/designer",
  "/jobs/role/designer/remote",
  "/jobs/role/recruiting-hr",
  "/jobs/role/sales-manager",
  "/jobs/role/marketing",
  "/jobs/role/operations",
  "/jobs/role/science",
  "/jobs/role/support",
] as const;

export const DEFAULT_USER_AGENT =
  process.env.YC_SCRAPER_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (JobScraper; +https://openned.dev)";

export const DEFAULT_HEADERS = {
  "User-Agent": DEFAULT_USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
};

export const DEFAULT_TIMEOUT_MS = parseInt(process.env.YC_SCRAPER_TIMEOUT_MS || "30000", 10);
export const DEFAULT_MAX_CONCURRENCY = parseInt(process.env.YC_SCRAPER_MAX_CONCURRENCY || "5", 10);
export const DEFAULT_REQUEST_DELAY_MS = parseInt(process.env.YC_SCRAPER_REQUEST_DELAY_MS || "300", 10);
export const DEFAULT_MAX_RETRIES = 3;

export const YC_JOB_URL_REGEX = /^https?:\/\/(?:www\.)?ycombinator\.com\/companies\/([^\/]+)\/jobs\/([^\/\?#]+)/i;
export const RELATIVE_JOB_URL_REGEX = /^\/companies\/([^\/]+)\/jobs\/([^\/\?#]+)/i;
