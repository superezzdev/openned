import { htmlToPlainText, sanitizeHtml } from "../../lib/ingestion/normalizer";
import { YCEmbeddedPageData, YCJobRaw, YCJsonLdJob } from "./types";
import { extractJobIdFromUrl } from "./fetcher";

/**
 * Strips HTML tags and decodes common HTML entities
 */
export function extractText(html: string | null | undefined): string {
  if (!html) return "";
  return htmlToPlainText(html);
}

/**
 * Priority 1: Extract Schema.org JSON-LD JobPosting data
 */
export function extractJsonLd(html: string): YCJsonLdJob | null {
  try {
    const scriptRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
      const startIndex = match.index + match[0].length;
      const remainingHtml = html.slice(startIndex);

      // Search for ending </script> tag, attempting JSON.parse on each </script> occurrence
      let closeIdx = -1;
      let searchOffset = 0;

      while ((closeIdx = remainingHtml.indexOf("</script>", searchOffset)) !== -1) {
        const candidate = remainingHtml.slice(0, closeIdx).trim();
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === "object") {
            if (parsed["@type"] === "JobPosting") {
              return parsed as YCJsonLdJob;
            }
            if (Array.isArray(parsed)) {
              const job = parsed.find((item) => item?.["@type"] === "JobPosting");
              if (job) return job as YCJsonLdJob;
            }
          }
        } catch {
          // Keep searching for the true closing </script> in case of nested script strings
          searchOffset = closeIdx + 9;
          continue;
        }
        break;
      }
    }
  } catch {
    // Gracefully handle malformed JSON-LD
  }
  return null;
}

/**
 * Priority 2: Extract embedded Inertia/React state data (data-page attribute)
 */
export function extractEmbeddedJobData(html: string): YCEmbeddedPageData | null {
  try {
    const match = html.match(/data-page="([^"]+)"/i);
    if (match) {
      const decoded = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      return JSON.parse(decoded) as YCEmbeddedPageData;
    }
  } catch {
    // Gracefully handle malformed data-page
  }
  return null;
}

/**
 * Helper: Extract Salary from JSON-LD, Embedded data, or HTML text
 */
export function extractSalary(
  jsonLd?: YCJsonLdJob | null,
  embedded?: YCEmbeddedPageData | null,
  html?: string
): {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryInterval: string | null;
} {
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  let salaryCurrency: string | null = null;
  let salaryInterval: string | null = null;

  // 1. From JSON-LD
  if (jsonLd?.baseSalary) {
    const bs = jsonLd.baseSalary;
    if (bs.currency) salaryCurrency = String(bs.currency).toUpperCase();
    if (typeof bs.value === "number") {
      salaryMin = bs.value;
      salaryMax = bs.value;
    } else if (bs.value && typeof bs.value === "object") {
      if (typeof bs.value.minValue === "number") salaryMin = bs.value.minValue;
      if (typeof bs.value.maxValue === "number") salaryMax = bs.value.maxValue;
      if (typeof bs.value.value === "number") {
        salaryMin = bs.value.value;
        salaryMax = bs.value.value;
      }
      if (bs.value.unitText) {
        const unit = bs.value.unitText.toUpperCase();
        salaryInterval = unit.includes("HOUR") ? "hourly" : unit.includes("MONTH") ? "monthly" : "yearly";
      }
    }
  }

  // 2. From Embedded state (job.salaryRange) e.g. "$100K - $200K" or "$1.5K - $2.5K / monthly" or "₹3M - ₹10M INR"
  const rawSalaryRange = embedded?.props?.job?.salaryRange;
  if ((salaryMin === null || salaryMax === null) && rawSalaryRange) {
    const rangeStr = String(rawSalaryRange).trim();

    if (rangeStr.toLowerCase().includes("monthly") || rangeStr.toLowerCase().includes("/ month")) {
      salaryInterval = "monthly";
    } else if (rangeStr.toLowerCase().includes("hour")) {
      salaryInterval = "hourly";
    } else if (!salaryInterval) {
      salaryInterval = "yearly";
    }

    if (rangeStr.includes("₹") || rangeStr.toUpperCase().includes("INR")) {
      salaryCurrency = "INR";
    } else if (rangeStr.includes("€") || rangeStr.toUpperCase().includes("EUR")) {
      salaryCurrency = "EUR";
    } else if (rangeStr.includes("£") || rangeStr.toUpperCase().includes("GBP")) {
      salaryCurrency = "GBP";
    } else if (rangeStr.includes("$") || rangeStr.toUpperCase().includes("USD")) {
      salaryCurrency = "USD";
    }

    const match = rangeStr.match(
      /(?:[\$€£₹]|\bINR\b)?\s*(\d+(?:\.\d+)?)\s*(k|m|mil|l|lakh)?\s*(?:-|to)\s*(?:[\$€£₹]|\bINR\b)?\s*(\d+(?:\.\d+)?)\s*(k|m|mil|l|lakh)?/i
    );

    if (match) {
      const parseVal = (numStr: string, unitStr?: string) => {
        const base = parseFloat(numStr);
        if (isNaN(base)) return null;
        const u = (unitStr || "").toLowerCase();
        if (u === "k") return base * 1000;
        if (u === "m" || u === "mil") return base * 1000000;
        if (u === "l" || u === "lakh") return base * 100000;
        if (base < 1000 && (salaryInterval === "yearly" || !salaryInterval)) return base * 1000;
        return base;
      };

      const min = parseVal(match[1], match[2] || match[4]);
      const max = parseVal(match[3], match[4]);
      if (min !== null) salaryMin = min;
      if (max !== null) salaryMax = max;
      if (!salaryCurrency) salaryCurrency = "USD";
    }
  }

  // 3. Fallback: parse from HTML body text
  if (salaryMin === null && html) {
    const textMatch = html.match(
      /(?:Salary|Compensation|Pay):\s*\$?(\d{2,3}(?:,\d{3})*(?:k)?)\s*(?:-|to)\s*\$?(\d{2,3}(?:,\d{3})*(?:k)?)/i
    );
    if (textMatch) {
      const parseVal = (v: string) => {
        const clean = v.toLowerCase().replace(/,/g, "");
        if (clean.endsWith("k")) return parseFloat(clean) * 1000;
        return parseFloat(clean);
      };
      salaryMin = parseVal(textMatch[1]);
      salaryMax = parseVal(textMatch[2]);
      if (!salaryCurrency) salaryCurrency = "USD";
      if (!salaryInterval) salaryInterval = "yearly";
    }
  }

  return {
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryInterval,
  };
}

/**
 * Helper: Extract Location and remote classification from JSON-LD, Embedded data, or HTML
 */
export function extractLocation(
  jsonLd?: YCJsonLdJob | null,
  embedded?: YCEmbeddedPageData | null,
  html?: string
): {
  location: string;
  locations: string[];
  remote: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
} {
  const locations: string[] = [];
  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;
  let remote = false;

  // 1. From JSON-LD
  if (jsonLd?.jobLocationType === "TELECOMMUTE" || jsonLd?.applicantLocationRequirements) {
    remote = true;
  }

  if (jsonLd?.jobLocation) {
    const locArray = Array.isArray(jsonLd.jobLocation) ? jsonLd.jobLocation : [jsonLd.jobLocation];
    for (const loc of locArray) {
      if (typeof loc === "string") {
        locations.push(loc);
      } else if (loc.address) {
        if (typeof loc.address === "string") {
          locations.push(loc.address);
        } else {
          city = loc.address.addressLocality || null;
          region = loc.address.addressRegion || null;
          country = loc.address.addressCountry || null;
          const parts = [city, region, country].filter(Boolean);
          if (parts.length > 0) {
            locations.push(parts.join(", "));
          }
        }
      }
    }
  }

  // 2. From Embedded state
  const embJob = embedded?.props?.job;
  if (embJob?.location) {
    if (Array.isArray(embJob.location)) {
      for (const loc of embJob.location) {
        const str = String(loc).trim();
        if (str && !locations.includes(str)) locations.push(str);
      }
    } else if (typeof embJob.location === "string") {
      const locStr = embJob.location.trim();
      if (locStr && !locations.includes(locStr)) {
        // May contain multiple separated by '/'
        if (locStr.includes("/")) {
          locStr.split("/").forEach((sub) => {
            const cleanSub = sub.trim();
            if (cleanSub && !locations.includes(cleanSub)) locations.push(cleanSub);
          });
        } else {
          locations.push(locStr);
        }
      }
    }
  }

  // Detect remote from string mentions
  const allLocText = locations.join(" ").toLowerCase();
  if (
    allLocText.includes("remote") ||
    allLocText.includes("anywhere") ||
    (embJob?.location && String(embJob.location).toLowerCase().includes("remote"))
  ) {
    remote = true;
  }

  // 3. Fallback: Semantic HTML / meta tags
  if (locations.length === 0 && html) {
    const metaLoc = html.match(/<meta\s+name=["']location["']\s+content=["']([^"']+)["']/i);
    if (metaLoc && metaLoc[1]) {
      locations.push(metaLoc[1].trim());
    }
  }

  const location = locations.length > 0 ? locations.join(", ") : remote ? "Remote" : "Unspecified";

  return {
    location,
    locations,
    remote,
    country,
    region,
    city,
  };
}

/**
 * Helper: Extract Company Name, Logo, URL, YC Batch, and Description
 */
export function extractCompany(
  jsonLd?: YCJsonLdJob | null,
  embedded?: YCEmbeddedPageData | null,
  html?: string,
  companySlug?: string
): {
  name: string;
  logoUrl: string | null;
  website: string | null;
  batch: string | null;
  description: string | null;
} {
  let name = "";
  let logoUrl: string | null = null;
  let website: string | null = null;
  let batch: string | null = null;
  let description: string | null = null;

  // 1. From JSON-LD
  if (jsonLd?.hiringOrganization) {
    if (jsonLd.hiringOrganization.name) name = jsonLd.hiringOrganization.name.trim();
    if (jsonLd.hiringOrganization.logo) logoUrl = jsonLd.hiringOrganization.logo.trim();
    if (jsonLd.hiringOrganization.sameAs) website = jsonLd.hiringOrganization.sameAs.trim();
  }

  // 2. From Embedded state (WaasShowJobPage company & job props)
  const embComp = embedded?.props?.company;
  const embJob = embedded?.props?.job;

  if (embComp) {
    if (!name && embComp.name) name = embComp.name.trim();
    if (!logoUrl) logoUrl = embComp.small_logo_url || embComp.logo_url || null;
    if (!website && embComp.website) website = embComp.website.trim();
    if (!batch && embComp.batch_name) batch = embComp.batch_name.trim();
    if (!description) description = embComp.one_liner || embComp.long_description || null;
  }

  if (embJob) {
    if (!name && embJob.companyName) name = embJob.companyName.trim();
    if (!logoUrl && embJob.companyLogoUrl) logoUrl = embJob.companyLogoUrl.trim();
    if (!batch && embJob.companyBatchName) batch = embJob.companyBatchName.trim();
    if (!description && embJob.companyOneLiner) description = embJob.companyOneLiner.trim();
  }

  // 3. From HTML meta / header tags
  if (!name && html) {
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (ogTitle && ogTitle[1].includes(" at ")) {
      const match = ogTitle[1].match(/at\s+([^|•]+)/i);
      if (match) name = match[1].trim();
    }
  }

  if (!logoUrl && html) {
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImage && ogImage[1]) logoUrl = ogImage[1].trim();
  }

  if (!batch && html) {
    const batchMatch = html.match(/\(([SW]\d{2})\)/i);
    if (batchMatch) batch = batchMatch[1].toUpperCase();
  }

  if (!name && companySlug) {
    name = companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
  }

  return {
    name: name || "YC Startup",
    logoUrl,
    website,
    batch,
    description,
  };
}

/**
 * Helper: Extract Job Description in HTML and Plain Text formats
 */
export function extractDescription(
  jsonLd?: YCJsonLdJob | null,
  embedded?: YCEmbeddedPageData | null,
  html?: string
): {
  description: string;
  descriptionHtml: string;
} {
  let rawHtml = "";

  // 1. From JSON-LD
  if (jsonLd?.description) {
    rawHtml = jsonLd.description;
  }

  // 2. From Embedded state (job.description)
  if (!rawHtml && embedded?.props?.job?.description) {
    rawHtml = embedded.props.job.description;
  }

  // 3. Fallback: Semantic HTML / meta description
  if (!rawHtml && html) {
    const aboutRoleMatch = html.match(/<h2[^>]*>About the role<\/h2>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (aboutRoleMatch) {
      rawHtml = aboutRoleMatch[1];
    } else {
      const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
      if (metaDesc && metaDesc[1]) {
        rawHtml = `<p>${metaDesc[1].trim()}</p>`;
      }
    }
  }

  const cleanHtml = sanitizeHtml(rawHtml);
  const cleanPlain = rawHtml.includes("<") ? htmlToPlainText(cleanHtml) : rawHtml.trim();

  return {
    description: cleanPlain,
    descriptionHtml: cleanHtml,
  };
}

/**
 * Helper: Extract Apply URL
 */
export function extractApplyUrl(
  embedded?: YCEmbeddedPageData | null,
  html?: string,
  canonicalUrl = ""
): string {
  // 1. From Embedded state
  if (embedded?.props?.job?.applyUrl) {
    return embedded.props.job.applyUrl.trim();
  }

  // 2. From HTML apply links
  if (html) {
    const applyMatch = html.match(/href=["'](https:\/\/account\.ycombinator\.com\/authenticate\?[^"']+)["']/i);
    if (applyMatch) {
      return applyMatch[1].replace(/&amp;/g, "&");
    }

    const waasMatch = html.match(/href=["'](https:\/\/www\.workatastartup\.com\/application\?[^"']+)["']/i);
    if (waasMatch) {
      return waasMatch[1].replace(/&amp;/g, "&");
    }
  }

  return canonicalUrl;
}

/**
 * Main Job Page Parser: Orchestrates 4-tier resilient extraction
 */
export function parseJobPage(html: string, canonicalUrl: string): YCJobRaw {
  const sourceJobId = extractJobIdFromUrl(canonicalUrl);

  // Extract Company slug from URL
  let companySlug = "";
  try {
    const parsed = new URL(canonicalUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "companies") {
      companySlug = parts[1];
    }
  } catch {
    // Ignore URL parse error
  }

  // Priority 1: JSON-LD
  const jsonLd = extractJsonLd(html);

  // Priority 2: Embedded state (data-page)
  const embedded = extractEmbeddedJobData(html);

  // Extract components
  const companyInfo = extractCompany(jsonLd, embedded, html, companySlug);
  const salaryInfo = extractSalary(jsonLd, embedded, html);
  const locationInfo = extractLocation(jsonLd, embedded, html);
  const descInfo = extractDescription(jsonLd, embedded, html);
  const applyUrl = extractApplyUrl(embedded, html, canonicalUrl);

  // Extract Title (Priority: JSON-LD -> Embedded -> Meta/Title tag)
  let title = "";
  if (jsonLd?.title) {
    title = jsonLd.title.trim();
  } else if (embedded?.props?.job?.title) {
    title = embedded.props.job.title.trim();
  } else {
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s+at\s+.*$/i, "").trim();
    }
  }
  if (!title) title = "Software Engineer";

  // Employment Type
  let employmentType = jsonLd?.employmentType || embedded?.props?.job?.type || null;
  if (employmentType) {
    employmentType = String(employmentType).toLowerCase().replace(/_/g, "-");
  }

  // Job Category / Role
  let jobCategory = embedded?.props?.job?.role || embedded?.props?.job?.prettyRole || null;
  if (!jobCategory && html) {
    const roleMatch = html.match(/<strong>Role<\/strong><\/div>\s*<span>([^<]+)<\/span>/i);
    if (roleMatch) jobCategory = roleMatch[1].trim();
  }

  // Experience Level
  let experienceLevel = embedded?.props?.job?.minExperience ? `${embedded.props.job.minExperience}+ years` : null;
  if (!experienceLevel && html) {
    const expMatch = html.match(/<strong>Experience<\/strong><\/div>\s*<span>([^<]+)<\/span>/i);
    if (expMatch) experienceLevel = expMatch[1].trim();
  }

  // Posted At
  let postedAt = jsonLd?.datePosted || null;
  if (!postedAt && embedded?.props?.job?.createdAt) {
    // Relative string like "about 5 years" or ISO
    const dateTry = new Date(embedded.props.job.createdAt);
    if (!isNaN(dateTry.getTime())) {
      postedAt = dateTry.toISOString();
    }
  }

  return {
    source_job_id: sourceJobId,
    title,
    company_name: companyInfo.name,
    company_logo_url: companyInfo.logoUrl,
    company_url: companyInfo.website,
    job_url: canonicalUrl,
    apply_url: applyUrl,
    description: descInfo.description || null,
    description_html: descInfo.descriptionHtml || null,
    location: locationInfo.locations.length > 0 ? locationInfo.locations : null,
    remote: locationInfo.remote,
    employment_type: employmentType,
    salary_min: salaryInfo.salaryMin,
    salary_max: salaryInfo.salaryMax,
    salary_currency: salaryInfo.salaryCurrency,
    salary_interval: salaryInfo.salaryInterval,
    job_category: jobCategory,
    experience_level: experienceLevel,
    yc_batch: companyInfo.batch,
    company_description: companyInfo.description,
    posted_at: postedAt,
    raw_payload: {
      jsonLd: jsonLd || null,
      embeddedJob: embedded?.props?.job || null,
      embeddedCompany: embedded?.props?.company || null,
      companySlug,
    },
  };
}
