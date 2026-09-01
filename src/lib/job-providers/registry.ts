import { JSearchProvider } from "./adapters/jsearch";
import { ActiveJobsDbProvider } from "./adapters/active-jobs-db";
import { JobPostingFeedProvider } from "./adapters/job-posting-feed";
import { LinkedInJobsProvider } from "./adapters/linkedin-jobs";
import { GlassdoorJobsProvider } from "./adapters/glassdoor";
import { JobicyProvider } from "./adapters/jobicy";
import { RemoteJobsProvider } from "./adapters/remote-jobs";
import { WorkdayProvider } from "./adapters/workday";
import { GoogleJobsProvider } from "./adapters/google-jobs";
import { FreeYcJobsProvider } from "./adapters/free-yc-jobs";
import { InternshipsProvider } from "./adapters/internships";
import { IndeedRapidProvider } from "./adapters/indeed-rapid";
import { FreelancerProvider } from "./adapters/freelancer";
import { SalaryEnricherProvider } from "./adapters/salary-enricher";
import { AdzunaProvider } from "./adapters/adzuna-provider";
import { JobProvider, JobSearchParams } from "./types";

export class JobProviderRegistry {
  private readonly providers = new Map<string, JobProvider>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const defaultProviders: JobProvider[] = [
      new JSearchProvider(),
      new ActiveJobsDbProvider(),
      new JobPostingFeedProvider(),
      new LinkedInJobsProvider(),
      new GlassdoorJobsProvider(),
      new JobicyProvider(),
      new RemoteJobsProvider(),
      new WorkdayProvider(),
      new GoogleJobsProvider(),
      new FreeYcJobsProvider(),
      new InternshipsProvider(),
      new IndeedRapidProvider(),
      new FreelancerProvider(),
      new SalaryEnricherProvider(),
      new AdzunaProvider(),
    ];

    for (const p of defaultProviders) {
      this.register(p);
    }
  }


  register(provider: JobProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): JobProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): JobProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Returns providers matching user source filters, parameters, and enabled status, sorted by priority
   */
  getEligibleProviders(params: JobSearchParams): JobProvider[] {
    const all = this.getAll().filter((p) => p.enabled && p.supports(params));

    if (params.sources && params.sources.length > 0) {
      const selected = new Set(params.sources.map((s) => s.toLowerCase()));
      return all.filter((p) => selected.has(p.id.toLowerCase()));
    }

    return all;
  }

  setEnabled(providerId: string, enabled: boolean): void {
    const p = this.providers.get(providerId);
    if (p) {
      Object.assign(p, { enabled });
    }
  }

  setPriority(providerId: string, priority: number): void {
    const p = this.providers.get(providerId);
    if (p) {
      Object.assign(p, { priority });
    }
  }

}

// Global Singleton Registry
export const jobProviderRegistry = new JobProviderRegistry();
