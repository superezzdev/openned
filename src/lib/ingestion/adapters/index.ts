import { JobSource, JobSourceAdapter } from "../types";
import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { AshbyAdapter } from "./ashby";
import { WorkableAdapter } from "./workable";
import { WellfoundAdapter } from "./wellfound";
import { SmartRecruitersAdapter } from "./smartrecruiters";
import { YCombinatorAdapter } from "../../../scrapers/ycombinator";
import { AdzunaAdapter } from "./adzuna";
import { FallbackParser } from "./fallback";

const adapters: Partial<Record<JobSource, JobSourceAdapter>> = {
  greenhouse: new GreenhouseAdapter(),
  lever: new LeverAdapter(),
  ashby: new AshbyAdapter(),
  workable: new WorkableAdapter(),
  wellfound: new WellfoundAdapter(),
  smartrecruiters: new SmartRecruitersAdapter(),
  ycombinator: new YCombinatorAdapter(),
  adzuna: new AdzunaAdapter(),
  custom: new FallbackParser(),
};


/**
 * Retrieves the adapter corresponding to a specific ATS source type
 */
export function getAdapterForSource(source: JobSource): JobSourceAdapter {
  const adapter = adapters[source];
  if (!adapter) {
    console.warn(`No registered adapter for source: ${source}. Using custom fallback parser.`);
    return adapters.custom || new FallbackParser();
  }
  return adapter;
}


export {
  GreenhouseAdapter,
  LeverAdapter,
  AshbyAdapter,
  WorkableAdapter,
  WellfoundAdapter,
  SmartRecruitersAdapter,
  YCombinatorAdapter,
  AdzunaAdapter,
  FallbackParser,
};

