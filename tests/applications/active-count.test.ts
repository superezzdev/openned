import { describe, it, expect, vi } from "vitest";
import { getActiveApplicationsCount } from "../../src/lib/applications/application-status-service";
import { ApplicationStatus, ACTIVE_APPLICATION_STATUSES } from "../../src/lib/applications/types";

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: () => ({
      from: (table: string) => {
        let selectedUserId = "";
        let selectedStatuses: string[] = [];

        const builder: any = {
          select: (columns: string, options?: any) => {
            return builder;
          },
          eq: (field: string, val: any) => {
            if (field === "user_id") selectedUserId = val;
            return builder;
          },
          in: (field: string, vals: any[]) => {
            if (field === "status") selectedStatuses = vals;
            // Return count based on test user
            if (selectedUserId === "user-with-zero-active") {
              return Promise.resolve({ count: 0, error: null });
            }
            if (selectedUserId === "user-with-two-active") {
              return Promise.resolve({ count: 2, error: null });
            }
            if (selectedUserId === "user-with-error") {
              return Promise.resolve({ count: null, error: { message: "DB Error" } });
            }
            return Promise.resolve({ count: 0, error: null });
          },
        };
        return builder;
      },
    }),
  };
});

describe("getActiveApplicationsCount", () => {
  it("returns 0 when user has 0 active applications", async () => {
    const count = await getActiveApplicationsCount("user-with-zero-active");
    expect(count).toBe(0);
  });

  it("returns the exact number of active applications when > 0", async () => {
    const count = await getActiveApplicationsCount("user-with-two-active");
    expect(count).toBe(2);
  });

  it("gracefully returns 0 on database error without throwing", async () => {
    const count = await getActiveApplicationsCount("user-with-error");
    expect(count).toBe(0);
  });
});
