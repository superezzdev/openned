import { JobSource, JobSourceAdapter } from "../types";
import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { AshbyAdapter } from "./ashby";
import { WorkableAdapter } from "./workable";
import { WellfoundAdapter } from "./wellfound";
import { FallbackParser } from "./fallback";

const adapters: Record<JobSource, JobSourceAdapter> = {
  greenhouse: new GreenhouseAdapter(),
  lever: new LeverAdapter(),
  ashby: new AshbyAdapter(),
  workable: new WorkableAdapter(),
  wellfound: new WellfoundAdapter(),
  custom: new FallbackParser(),
};

/**
 * Retrieves the adapter corresponding to a specific ATS source type
 */
export function getAdapterForSource(source: JobSource): JobSourceAdapter {
  const adapter = adapters[source];
  if (!adapter) {
    console.warn(`No registered adapter for source: ${source}. Using custom fallback parser.`);
    return adapters.custom;
  }
  return adapter;
}

export {
  GreenhouseAdapter,
  LeverAdapter,
  AshbyAdapter,
  WorkableAdapter,
  WellfoundAdapter,
  FallbackParser,
};
