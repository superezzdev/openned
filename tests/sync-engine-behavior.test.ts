import { describe, it, expect, vi } from "vitest";
import { computeJobContentHash } from "../src/lib/ingestion/hasher";
import { validateNormalizedJob } from "../src/lib/ingestion/validator";
import { NormalizedJob } from "../src/lib/ingestion/types";

describe("Sync Engine State Transition & Reconciler Logic", () => {
  // Mock DB state
  interface MockDbJob {
    id: string;
    source: string;
    source_job_id: string;
    title: string;
    description: string;
    content_hash: string;
    active: boolean;
  }

  function simulateSyncEngine(
    sourceJobs: Partial<NormalizedJob>[],
    existingDb: MockDbJob[],
    isFailedRequest: boolean = false
  ) {
    const stats = {
      jobsFetched: 0,
      jobsCreated: 0,
      jobsUpdated: 0,
      jobsUnchanged: 0,
      jobsDeactivated: 0,
      errors: [] as string[],
    };

    if (isFailedRequest) {
      stats.errors.push("Simulated HTTP 500 error fetching source");
      return { stats, db: existingDb };
    }

    stats.jobsFetched = sourceJobs.length;
    const existingMap = new Map<string, MockDbJob>();
    for (const j of existingDb) {
      existingMap.set(j.source_job_id, { ...j });
    }

    const seenSourceJobIds = new Set<string>();
    const upsertMap = new Map<string, MockDbJob>();

    for (const raw of sourceJobs) {
      const validation = validateNormalizedJob(raw);
      if (!validation.valid || !validation.sanitizedJob) {
        stats.errors.push(`Validation failed for ${raw.source_job_id}`);
        continue;
      }
      const job = validation.sanitizedJob;
      const isDuplicateInBatch = seenSourceJobIds.has(job.source_job_id);
      seenSourceJobIds.add(job.source_job_id);

      const contentHash = computeJobContentHash(job);
      const existing = existingMap.get(job.source_job_id);

      if (!isDuplicateInBatch) {
        if (!existing) {
          stats.jobsCreated++;
        } else if (existing.content_hash !== contentHash || !existing.active) {
          stats.jobsUpdated++;
        } else {
          stats.jobsUnchanged++;
        }
      }

      upsertMap.set(job.source_job_id, {
        id: existing?.id || `job-${job.source_job_id}`,
        source: job.source,
        source_job_id: job.source_job_id,
        title: job.title,
        description: job.description || "",
        content_hash: contentHash,
        active: true,
      });
    }

    // Deactivation logic with safety guard
    const updatedDb = Array.from(upsertMap.values());
    const activeExistingCount = existingDb.filter((j) => j.active).length;
    const missingToDeactivate: string[] = [];

    if (sourceJobs.length > 0 && stats.jobsFetched > 0 && stats.errors.length < sourceJobs.length * 0.5) {
      for (const existing of existingDb) {
        if (!seenSourceJobIds.has(existing.source_job_id) && existing.active) {
          missingToDeactivate.push(existing.id);
        }
      }

      // Safety guard against mass accidental deactivations (>70% drop when active count >= 5)
      if (activeExistingCount >= 5 && missingToDeactivate.length > activeExistingCount * 0.7) {
        stats.errors.push(`[Mass Deactivation Prevented] ${missingToDeactivate.length} missing jobs.`);
        missingToDeactivate.length = 0;
      }

      stats.jobsDeactivated = missingToDeactivate.length;
    }

    // Apply deactivations to missing records
    for (const existing of existingDb) {
      if (!upsertMap.has(existing.source_job_id)) {
        updatedDb.push({
          ...existing,
          active: missingToDeactivate.includes(existing.id) ? false : existing.active,
        });
      }
    }

    return { stats, db: updatedDb };
  }

  const sampleJob1: NormalizedJob = {
    source: "greenhouse",
    source_job_id: "job-101",
    company_name: "Stripe",
    title: "Backend Engineer",
    description: "Build payment systems",
    location: "San Francisco, CA",
    locations_json: ["San Francisco, CA"],
    remote_type: "onsite",
    employment_type: "full-time",
    job_url: "https://stripe.com/jobs/101",
    apply_url: "https://stripe.com/jobs/101/apply",
  };

  const sampleJob2: NormalizedJob = {
    source: "greenhouse",
    source_job_id: "job-102",
    company_name: "Stripe",
    title: "Frontend Engineer",
    description: "Build checkout UI",
    location: "Remote",
    locations_json: ["Remote"],
    remote_type: "remote",
    employment_type: "full-time",
    job_url: "https://stripe.com/jobs/102",
    apply_url: "https://stripe.com/jobs/102/apply",
  };

  it("Transition 1: First sync inserts all new jobs (created > 0)", () => {
    const { stats, db } = simulateSyncEngine([sampleJob1, sampleJob2], []);
    expect(stats.jobsCreated).toBe(2);
    expect(stats.jobsUpdated).toBe(0);
    expect(stats.jobsUnchanged).toBe(0);
    expect(stats.jobsDeactivated).toBe(0);
    expect(db.filter((j) => j.active).length).toBe(2);
  });

  it("Transition 2: Second sync with identical data leaves jobs unchanged (created = 0, updated = 0, unchanged = 2)", () => {
    // Initial DB with 2 jobs
    const { db: initialDb } = simulateSyncEngine([sampleJob1, sampleJob2], []);

    // Re-run sync with exact same data
    const { stats, db } = simulateSyncEngine([sampleJob1, sampleJob2], initialDb);
    expect(stats.jobsCreated).toBe(0);
    expect(stats.jobsUpdated).toBe(0);
    expect(stats.jobsUnchanged).toBe(2);
    expect(stats.jobsDeactivated).toBe(0);
    expect(db.filter((j) => j.active).length).toBe(2);
  });

  it("Transition 3: Modified source data triggers update (updated > 0)", () => {
    const { db: initialDb } = simulateSyncEngine([sampleJob1, sampleJob2], []);

    // Modify title of job 1
    const modifiedJob1 = {
      ...sampleJob1,
      title: "Senior Backend Engineer, Payments",
    };

    const { stats, db } = simulateSyncEngine([modifiedJob1, sampleJob2], initialDb);
    expect(stats.jobsCreated).toBe(0);
    expect(stats.jobsUpdated).toBe(1);
    expect(stats.jobsUnchanged).toBe(1);
    expect(db.find((j) => j.source_job_id === "job-101")?.title).toBe("Senior Backend Engineer, Payments");
  });

  it("Transition 4: Removed/closed source job marks active=false after reconciliation", () => {
    const { db: initialDb } = simulateSyncEngine([sampleJob1, sampleJob2], []);

    // Job 1 closed upstream, only Job 2 returned
    const { stats, db } = simulateSyncEngine([sampleJob2], initialDb);
    expect(stats.jobsCreated).toBe(0);
    expect(stats.jobsUpdated).toBe(0);
    expect(stats.jobsUnchanged).toBe(1);
    expect(stats.jobsDeactivated).toBe(1);

    const closedJob = db.find((j) => j.source_job_id === "job-101");
    expect(closedJob?.active).toBe(false);

    const activeJob = db.find((j) => j.source_job_id === "job-102");
    expect(activeJob?.active).toBe(true);
  });

  it("Transition 5: Failed source request leaves existing jobs untouched and active", () => {
    const { db: initialDb } = simulateSyncEngine([sampleJob1, sampleJob2], []);

    // Request failed with 500 error
    const { stats, db } = simulateSyncEngine([], initialDb, true);
    expect(stats.jobsCreated).toBe(0);
    expect(stats.jobsUpdated).toBe(0);
    expect(stats.jobsDeactivated).toBe(0);
    expect(stats.errors.length).toBeGreaterThan(0);
    expect(db.filter((j) => j.active).length).toBe(2);
  });

  it("Deduplication: In-batch duplicates are merged without throwing duplicate errors", () => {
    // Array with job-101 included twice
    const { stats, db } = simulateSyncEngine([sampleJob1, sampleJob1, sampleJob2], []);
    expect(stats.jobsCreated).toBe(2);
    expect(stats.jobsUpdated).toBe(0);
    expect(db.length).toBe(2);
  });
});
