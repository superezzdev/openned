import { DiscoveredSource } from "./types";

/**
 * Parses any job board / career URL to identify the ATS provider and board slug
 */
export function discoverSourceFromUrl(url: string, defaultCompanyName?: string): DiscoveredSource | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/^\/|\/$/g, "");
    const segments = pathname.split("/").filter(Boolean);

    // 1. Greenhouse (e.g. boards.greenhouse.io/stripe or greenhouse.io/jobs/stripe)
    if (host.includes("greenhouse.io")) {
      const slug = segments[0] || "";
      if (!slug) return null;
      const companyName = defaultCompanyName || formatCompanyName(slug);
      return {
        source: "greenhouse",
        source_name: `${companyName} (Greenhouse)`,
        source_identifier: slug.toLowerCase(),
        company_name: companyName,
        company_logo: `/platforms/Greenhouse.png`,
        source_url: `https://boards.greenhouse.io/${slug}`,
      };
    }

    // 2. Lever (e.g. jobs.lever.co/vercel or lever.co/jobs/vercel)
    if (host.includes("lever.co")) {
      const slug = segments[0] || "";
      if (!slug) return null;
      const companyName = defaultCompanyName || formatCompanyName(slug);
      return {
        source: "lever",
        source_name: `${companyName} (Lever)`,
        source_identifier: slug.toLowerCase(),
        company_name: companyName,
        company_logo: `/platforms/Lever.png`,
        source_url: `https://jobs.lever.co/${slug}`,
      };
    }

    // 3. Ashby (e.g. jobs.ashbyhq.com/openai or ashbyhq.com/openai)
    if (host.includes("ashbyhq.com")) {
      const slug = segments[0] || "";
      if (!slug) return null;
      const companyName = defaultCompanyName || formatCompanyName(slug);
      return {
        source: "ashby",
        source_name: `${companyName} (Ashby)`,
        source_identifier: slug,
        company_name: companyName,
        company_logo: `/platforms/Ashby.png`,
        source_url: `https://jobs.ashbyhq.com/${slug}`,
      };
    }

    // 4. Workable (e.g. apply.workable.com/perplexity or supabase.workable.com)
    if (host.includes("workable.com")) {
      let slug = "";
      if (host.includes("apply.workable.com")) {
        slug = segments[0] || "";
      } else {
        const sub = host.split(".")[0];
        if (sub && sub !== "www" && sub !== "apply") {
          slug = sub;
        }
      }
      if (!slug) return null;
      const companyName = defaultCompanyName || formatCompanyName(slug);
      return {
        source: "workable",
        source_name: `${companyName} (Workable)`,
        source_identifier: slug.toLowerCase(),
        company_name: companyName,
        company_logo: `/platforms/Workable.png`,
        source_url: `https://apply.workable.com/${slug}`,
      };
    }

    // 5. Wellfound / AngelList (e.g. wellfound.com/company/replit or angel.co/company/cursor)
    if (host.includes("wellfound.com") || host.includes("angel.co")) {
      let slug = "";
      if (segments[0] === "company" || segments[0] === "l") {
        slug = segments[1] || "";
      } else if (segments[0] === "jobs" && segments.length > 1) {
        slug = segments[1];
      } else if (segments[0] && !["jobs", "login", "signup", "recruit", "pricing", "blog", "discover"].includes(segments[0])) {
        slug = segments[0];
      }
      if (!slug) return null;
      const companyName = defaultCompanyName || formatCompanyName(slug);
      return {
        source: "wellfound",
        source_name: `${companyName} (Wellfound)`,
        source_identifier: slug.toLowerCase(),
        company_name: companyName,
        company_logo: `/platforms/wellfound.png`,
        source_url: `https://wellfound.com/company/${slug}`,
      };
    }

    // 6. Custom / Generic Career page fallback
    const domainPart = host.replace(/^www\./, "").split(".")[0];
    const companyName = defaultCompanyName || formatCompanyName(domainPart);
    return {
      source: "custom",
      source_name: `${companyName} (Career Site)`,
      source_identifier: host,
      company_name: companyName,
      company_logo: null,
      source_url: url.trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Formats a slug into a readable company name
 */
export function formatCompanyName(slug: string): string {
  if (!slug) return "Company";
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
