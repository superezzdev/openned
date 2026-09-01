/**
 * Browser Provider Selector
 *
 * Resolves which BrowserProvider instance to use for an application run based
 * on user preferences, current application state, and prior fallback status.
 */

import {
  BrowserProvider,
  AutomationProvider,
  AutomationPreference,
} from "./types";
import { LocalBrowserProvider } from "./local-browser-provider";
import { BrowserbaseProvider } from "./browserbase-provider";

export interface ProviderSelectionOptions {
  forceProvider?: AutomationProvider;
}

export function selectBrowserProvider(
  application: {
    automation_preference?: string | null;
    automation_provider?: string | null;
    fallback_used?: boolean | null;
  },
  options?: ProviderSelectionOptions
): BrowserProvider {
  if (options?.forceProvider === AutomationProvider.BROWSERBASE) {
    return new BrowserbaseProvider();
  }
  if (options?.forceProvider === AutomationProvider.LOCAL) {
    return new LocalBrowserProvider();
  }

  // 1. Explicit user preferences take absolute precedence
  const pref = application.automation_preference || AutomationPreference.AUTO;

  if (pref === AutomationPreference.LOCAL_ONLY) {
    return new LocalBrowserProvider();
  }

  if (pref === AutomationPreference.BROWSERBASE_ONLY) {
    return new BrowserbaseProvider();
  }

  // 2. AUTO mode: If fallback was already used, resume with Browserbase
  if (application.fallback_used) {
    return new BrowserbaseProvider();
  }

  // 3. AUTO mode: If already designated as Browserbase
  if (application.automation_provider === AutomationProvider.BROWSERBASE) {
    return new BrowserbaseProvider();
  }

  // 4. AUTO default: start with LocalBrowserProvider first
  return new LocalBrowserProvider();
}

