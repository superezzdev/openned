import { describe, it, expect } from "vitest";
import { ApplicationStatus, ACTIVE_APPLICATION_STATUSES } from "../src/lib/applications/types";

describe("Saved Jobs & Application Status Resolution Logic", () => {
  interface MockJob {
    id: string;
    title: string;
    company: string;
    saved_status: boolean;
    applied_status: boolean;
  }

  interface MockApp {
    id: string;
    status: ApplicationStatus;
  }

  const resolveApplicationBadge = (
    job: MockJob,
    app?: MockApp | null
  ): { label: string; style: string } => {
    if (!job.applied_status && !app) {
      return { label: "Ready to Apply", style: "default" };
    }

    if (app?.status === ApplicationStatus.SUBMITTED) {
      return { label: "Submitted", style: "emerald" };
    }

    if (app && ACTIVE_APPLICATION_STATUSES.includes(app.status)) {
      return { label: "In Progress", style: "violet" };
    }

    if (
      app?.status === ApplicationStatus.MISSING_PROFILE_INFO ||
      app?.status === ApplicationStatus.AWAITING_USER_INPUT
    ) {
      return { label: "Action Required", style: "amber" };
    }

    if (app?.status === ApplicationStatus.AWAITING_USER_REVIEW) {
      return { label: "Review Required", style: "sky" };
    }

    return { label: "Applied", style: "blue" };
  };

  it("should display Ready to Apply when job is saved but not applied", () => {
    const job: MockJob = {
      id: "job-1",
      title: "Frontend Engineer",
      company: "Acme",
      saved_status: true,
      applied_status: false,
    };
    const badge = resolveApplicationBadge(job, null);
    expect(badge.label).toBe("Ready to Apply");
  });

  it("should display Submitted when application status is SUBMITTED", () => {
    const job: MockJob = {
      id: "job-2",
      title: "Fullstack Engineer",
      company: "Stripe",
      saved_status: true,
      applied_status: true,
    };
    const app: MockApp = {
      id: "app-1",
      status: ApplicationStatus.SUBMITTED,
    };
    const badge = resolveApplicationBadge(job, app);
    expect(badge.label).toBe("Submitted");
    expect(badge.style).toBe("emerald");
  });

  it("should display In Progress when application is actively progressing", () => {
    const job: MockJob = {
      id: "job-3",
      title: "Backend Engineer",
      company: "Netflix",
      saved_status: true,
      applied_status: true,
    };
    const app: MockApp = {
      id: "app-2",
      status: ApplicationStatus.FILLING_FORM,
    };
    const badge = resolveApplicationBadge(job, app);
    expect(badge.label).toBe("In Progress");
    expect(badge.style).toBe("violet");
  });

  it("should display Action Required when application is paused for missing info", () => {
    const job: MockJob = {
      id: "job-4",
      title: "AI Engineer",
      company: "OpenAI",
      saved_status: true,
      applied_status: true,
    };
    const app: MockApp = {
      id: "app-3",
      status: ApplicationStatus.MISSING_PROFILE_INFO,
    };
    const badge = resolveApplicationBadge(job, app);
    expect(badge.label).toBe("Action Required");
    expect(badge.style).toBe("amber");
  });

  it("should display Review Required when application awaits user confirmation", () => {
    const job: MockJob = {
      id: "job-5",
      title: "Staff Engineer",
      company: "Google",
      saved_status: true,
      applied_status: true,
    };
    const app: MockApp = {
      id: "app-4",
      status: ApplicationStatus.AWAITING_USER_REVIEW,
    };
    const badge = resolveApplicationBadge(job, app);
    expect(badge.label).toBe("Review Required");
    expect(badge.style).toBe("sky");
  });

  it("should accurately filter saved jobs by status tab", () => {
    const savedJobs: MockJob[] = [
      { id: "1", title: "Job 1", company: "A", saved_status: true, applied_status: false },
      { id: "2", title: "Job 2", company: "B", saved_status: true, applied_status: true },
      { id: "3", title: "Job 3", company: "C", saved_status: true, applied_status: true },
      { id: "4", title: "Job 4", company: "D", saved_status: false, applied_status: false },
    ];

    const appMap: Record<string, MockApp> = {
      "2": { id: "a2", status: ApplicationStatus.SUBMITTED },
      "3": { id: "a3", status: ApplicationStatus.QUEUED },
    };

    // Filter by saved only
    const onlySaved = savedJobs.filter((j) => j.saved_status);
    expect(onlySaved.length).toBe(3);

    // Filter by submitted
    const submitted = onlySaved.filter(
      (j) => appMap[j.id]?.status === ApplicationStatus.SUBMITTED || (!appMap[j.id] && j.applied_status)
    );
    expect(submitted.length).toBe(1);
    expect(submitted[0].id).toBe("2");

    // Filter by in progress
    const inProgress = onlySaved.filter(
      (j) => appMap[j.id] && ACTIVE_APPLICATION_STATUSES.includes(appMap[j.id].status)
    );
    expect(inProgress.length).toBe(1);
    expect(inProgress[0].id).toBe("3");

    // Filter by not applied
    const notApplied = onlySaved.filter((j) => !j.applied_status && !appMap[j.id]);
    expect(notApplied.length).toBe(1);
    expect(notApplied[0].id).toBe("1");
  });
});
