import { NormalizedJob } from "../../ingestion/types";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export interface SalaryRangeResponse {
  data?: {
    jobTitle?: string;
    salaryMin?: number;
    salaryMax?: number;
    salaryMedian?: number;
    currency?: string;
  };
}

export interface CompanySalaryResponse {
  data?: {
    company_name?: string;
    job_title?: string;
    avg_base_pay?: number;
    min_base_pay?: number;
    max_base_pay?: number;
    currency?: string;
  };
}

export class SalaryEnricherProvider implements JobProvider {
  readonly id = "salary-enricher";
  readonly name = "Salary & Benchmark Intelligence";
  readonly priority = 13;
  readonly enabled = true;
  readonly timeoutMs = 8000;
  readonly maxRetries = 1;

  supports(): boolean {
    return true;
  }

  /**
   * Enricher can be called as a provider or directly to enrich a list of normalized jobs
   */
  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const query = params.query?.trim() || "developer";
    const country = (params.country || "us").toLowerCase();

    try {
      const response = await executeRapidApiRequest<SalaryRangeResponse>({
        providerId: this.id,
        providerName: this.name,
        host: "jobs-api14.p.rapidapi.com",
        url: `https://jobs-api14.p.rapidapi.com/v2/salary/range?query=${encodeURIComponent(query)}&countryCode=${encodeURIComponent(country)}`,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      });

      const salaryData = response.data?.data;
      const normalizedJobs: NormalizedJob[] = [];

      if (salaryData?.salaryMin || salaryData?.salaryMax) {
        normalizedJobs.push({
          source: "salary-enricher",
          source_job_id: `salary-benchmark-${query}-${country}`,
          company_name: "Industry Salary Benchmark",
          company_logo: "/platforms/salary.svg",
          title: `${query.charAt(0).toUpperCase() + query.slice(1)} (Benchmark)`,
          description: `Industry benchmark salary range for ${query} in ${country.toUpperCase()}: ${salaryData.salaryMin} - ${salaryData.salaryMax} ${salaryData.currency || "USD"}`,
          description_html: `<p>Industry benchmark salary range for ${query} in ${country.toUpperCase()}: ${salaryData.salaryMin} - ${salaryData.salaryMax} ${salaryData.currency || "USD"}</p>`,
          location: country.toUpperCase(),
          locations_json: [country.toUpperCase()],
          country: country.toUpperCase(),
          region: null,
          city: null,
          remote_type: "hybrid",
          employment_type: "full-time",
          department: "Salary Benchmark",
          team: null,
          salary_min: salaryData.salaryMin || null,
          salary_max: salaryData.salaryMax || null,
          salary_currency: salaryData.currency || "USD",
          salary_interval: "yearly",
          job_url: "https://rapidapi.com/jobs-api14",
          apply_url: "https://rapidapi.com/jobs-api14",
          posted_at: new Date().toISOString(),
          updated_at_source: new Date().toISOString(),
          raw_payload: response.data as Record<string, unknown>,
        });
      }

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: normalizedJobs,
        total: normalizedJobs.length,
        hasMore: false,
        latencyMs: response.latencyMs,
        status: normalizedJobs.length === 0 ? "empty" : "success",
      };
    } catch (err: unknown) {
      const errorObj = err as Error & { isRateLimit?: boolean; isTimeout?: boolean };
      return {
        providerId: this.id,
        providerName: this.name,
        jobs: [],
        latencyMs: 0,
        status: errorObj.isRateLimit ? "rate_limited" : errorObj.isTimeout ? "timeout" : "error",
        errorMessage: errorObj.message || String(err),
      };
    }
  }
}

