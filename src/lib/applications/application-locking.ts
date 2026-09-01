/**
 * Application Locking Service
 *
 * Provides distributed lock management to prevent concurrent automation
 * of the same application. Uses Supabase as the lock store.
 *
 * Lock lifecycle:
 *   acquireApplicationLock() → runs worker → releaseApplicationLock()
 *
 * Stale lock recovery: locks older than lock_ttl_seconds are considered stale
 * and can be reclaimed by a new worker.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { logApplicationEvent } from "./application-status-service";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

const LOCK_TTL_SECONDS = 300; // 5 minutes

/**
 * Attempt to acquire an exclusive lock on an application.
 * Returns the worker ID if lock acquired, null if already locked.
 */
export async function acquireApplicationLock(applicationId: string): Promise<string | null> {
  const supabase = getAdminClient();
  const workerId = crypto.randomUUID();
  const now = new Date();

  // First, clean stale locks for this application
  await recoverStaleLockForApplication(applicationId);

  const { error } = await supabase
    .from("application_worker_locks")
    .insert({
      application_id: applicationId,
      worker_id: workerId,
      locked_at: now.toISOString(),
      heartbeat_at: now.toISOString(),
      lock_ttl_seconds: LOCK_TTL_SECONDS,
    });

  if (error) {
    // Unique constraint violation means another worker holds the lock
    logApplicationEvent("application_lock_denied", {
      application_id: applicationId,
      reason: "already_locked",
    });
    return null;
  }

  logApplicationEvent("application_lock_acquired", {
    application_id: applicationId,
    worker_id: workerId,
  });

  return workerId;
}

/**
 * Release the lock held by this worker.
 */
export async function releaseApplicationLock(
  applicationId: string,
  workerId: string
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from("application_worker_locks")
    .delete()
    .eq("application_id", applicationId)
    .eq("worker_id", workerId);

  if (error) {
    console.warn("[ApplicationLocking] Failed to release lock:", error.message);
  } else {
    logApplicationEvent("application_lock_released", {
      application_id: applicationId,
      worker_id: workerId,
    });
  }
}

/**
 * Send a heartbeat to keep the lock alive during long-running operations.
 * Call this every ~30 seconds from within the worker.
 */
export async function heartbeatApplicationLock(
  applicationId: string,
  workerId: string
): Promise<void> {
  const supabase = getAdminClient();

  await supabase
    .from("application_worker_locks")
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .eq("worker_id", workerId);
}

/**
 * Recover stale locks for a specific application.
 * A lock is stale if heartbeat_at + lock_ttl_seconds < now.
 */
export async function recoverStaleLockForApplication(applicationId: string): Promise<void> {
  const supabase = getAdminClient();

  const { data: lock } = await supabase
    .from("application_worker_locks")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle();

  if (!lock) return;

  const heartbeat = new Date(lock.heartbeat_at).getTime();
  const ttlMs = (lock.lock_ttl_seconds || LOCK_TTL_SECONDS) * 1000;
  const stale = Date.now() - heartbeat > ttlMs;

  if (stale) {
    logApplicationEvent("application_stale_lock_recovered", {
      application_id: applicationId,
      old_worker_id: lock.worker_id,
      locked_at: lock.locked_at,
    });

    await supabase
      .from("application_worker_locks")
      .delete()
      .eq("application_id", applicationId);

    // Clean up application status if worker crashed mid-operation
    const { data: app } = await supabase
      .from("applications")
      .select("status, debug_info")
      .eq("id", applicationId)
      .maybeSingle();

    if (app) {
      if (app.status === "SUBMITTING" || app.debug_info?.submit_attempted) {
        await supabase
          .from("applications")
          .update({
            status: "SUBMISSION_UNCONFIRMED",
            error_message: "Submission was in progress when worker disconnected. Please verify on employer site.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationId);
      } else if ([
        "QUEUED", "DETECTING_PLATFORM", "DETECTING_FORM",
        "MAPPING_FIELDS", "READY_TO_APPLY", "FILLING_FORM"
      ].includes(app.status)) {
        await supabase
          .from("applications")
          .update({
            status: "FAILED",
            failure_code: "TIMEOUT",
            error_message: "The automation worker encountered an unexpected error or timeout. You can retry.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationId);
      }
    }
  }
}

/**
 * Global stale lock recovery — call from a cron or admin endpoint.
 */
export async function recoverStaleLocks(): Promise<number> {
  const supabase = getAdminClient();

  const { data: locks } = await supabase
    .from("application_worker_locks")
    .select("*");

  if (!locks || locks.length === 0) return 0;

  let recovered = 0;
  for (const lock of locks) {
    const heartbeat = new Date(lock.heartbeat_at).getTime();
    const ttlMs = (lock.lock_ttl_seconds || LOCK_TTL_SECONDS) * 1000;
    if (Date.now() - heartbeat > ttlMs) {
      await recoverStaleLockForApplication(lock.application_id);
      recovered++;
    }
  }

  return recovered;
}

/**
 * Check whether an application is currently locked by another worker.
 */
export async function isApplicationLocked(applicationId: string): Promise<boolean> {
  const supabase = getAdminClient();

  const { data: lock } = await supabase
    .from("application_worker_locks")
    .select("heartbeat_at, lock_ttl_seconds")
    .eq("application_id", applicationId)
    .maybeSingle();

  if (!lock) return false;

  const heartbeat = new Date(lock.heartbeat_at).getTime();
  const ttlMs = (lock.lock_ttl_seconds || LOCK_TTL_SECONDS) * 1000;
  return Date.now() - heartbeat <= ttlMs;
}
