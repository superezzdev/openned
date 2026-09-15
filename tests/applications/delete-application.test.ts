import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ApplicationStatus } from "../../src/lib/applications/types";

// Mock Supabase server and admin
const mockUser = { id: "test-user-123" };
let mockApps: any[] = [];
let mockLocks: any[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
    },
  })),
}));

vi.mock("@/lib/applications/types", () => ({
  ApplicationStatus: {
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    SUBMITTED: "SUBMITTED",
    QUEUED: "QUEUED",
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      let filteredUserId = "";
      let filteredId = "";
      let filteredStatus: string | string[] | null = null;

      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: any) => {
          if (col === "user_id") filteredUserId = val;
          if (col === "id") filteredId = val;
          if (col === "application_id") filteredId = val;
          if (col === "status") filteredStatus = val;
          return builder;
        }),
        in: vi.fn((col: string, vals: any[]) => {
          if (col === "status") filteredStatus = vals;
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "applications") {
            const found = mockApps.find(a => a.id === filteredId && a.user_id === filteredUserId);
            return { data: found || null, error: null };
          }
          return { data: null, error: null };
        }),
        delete: vi.fn(() => {
          const deleteBuilder: any = {
            eq: vi.fn((col: string, val: any) => {
              if (col === "user_id") filteredUserId = val;
              if (col === "id") filteredId = val;
              if (col === "application_id") filteredId = val;
              return deleteBuilder;
            }),
            in: vi.fn((col: string, vals: any[]) => {
              if (col === "status") filteredStatus = vals;
              return deleteBuilder;
            }),
            then: (resolve: any) => {
              if (table === "applications") {
                if (filteredId) {
                  mockApps = mockApps.filter(a => !(a.id === filteredId && a.user_id === filteredUserId));
                } else if (filteredStatus) {
                  const statuses = Array.isArray(filteredStatus) ? filteredStatus : [filteredStatus];
                  mockApps = mockApps.filter(a => !(a.user_id === filteredUserId && statuses.includes(a.status)));
                }
              } else if (table === "application_worker_locks") {
                if (filteredId) {
                  mockLocks = mockLocks.filter(l => l.application_id !== filteredId);
                }
              }
              return resolve({ data: null, error: null });
            },
          };
          return deleteBuilder;
        }),
      };
      return builder;
    },
  })),
}));

describe("DELETE /api/applications/[id] and /api/applications", () => {
  beforeEach(() => {
    mockApps = [
      { id: "app-1", user_id: "test-user-123", status: ApplicationStatus.FAILED },
      { id: "app-2", user_id: "test-user-123", status: ApplicationStatus.CANCELLED },
      { id: "app-3", user_id: "test-user-123", status: ApplicationStatus.SUBMITTED },
      { id: "app-4", user_id: "other-user", status: ApplicationStatus.FAILED },
    ];
    mockLocks = [{ application_id: "app-1", worker_id: "w-1" }];
  });

  it("deletes a single application owned by the user", async () => {
    const { DELETE } = await import("../../src/app/api/applications/[id]/route");
    const req = new NextRequest("http://localhost:3000/api/applications/app-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "app-1" }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.id).toBe("app-1");
    expect(mockApps.find(a => a.id === "app-1")).toBeUndefined();
    expect(mockLocks.find(l => l.application_id === "app-1")).toBeUndefined();
  });

  it("returns 404 when trying to delete an application not belonging to the user", async () => {
    const { DELETE } = await import("../../src/app/api/applications/[id]/route");
    const req = new NextRequest("http://localhost:3000/api/applications/app-4", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "app-4" }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Application not found");
    expect(mockApps.find(a => a.id === "app-4")).toBeDefined();
  });

  it("bulk deletes all failed and cancelled applications for the user", async () => {
    const { DELETE } = await import("../../src/app/api/applications/route");
    const req = new NextRequest("http://localhost:3000/api/applications?status=FAILED", { method: "DELETE" });
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockApps.filter(a => a.user_id === "test-user-123")).toHaveLength(1);
    expect(mockApps.find(a => a.id === "app-3")).toBeDefined(); // SUBMITTED still remains
  });
});
