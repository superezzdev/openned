import { describe, it, expect } from "vitest";
import { detectApplicationFields, detectLoginRequired } from "../../src/lib/applications/form-detector";

describe("Form Detection, Iframe Binding & Evaluate Resilience", () => {
  it("detects fields without throwing __name ReferenceError inside browser evaluation", async () => {
    const mockPage = {
      evaluate: async () => [
        { field_id: "first_name", label: "First Name", type: "text", required: true, selector: "#first_name" },
        { field_id: "last_name", label: "Last Name", type: "text", required: true, selector: "#last_name" },
      ],
      url: () => "https://boards.greenhouse.io/test/jobs/123",
      rawPage: {
        evaluate: async () => [
          { field_id: "first_name", label: "First Name", type: "text", required: true, selector: "#first_name" },
          { field_id: "last_name", label: "Last Name", type: "text", required: true, selector: "#last_name" },
        ],
        frames: () => [],
      },
    };

    const fields = await detectApplicationFields(mockPage);
    expect(fields.length).toBe(2);
    expect(fields[0].field_id).toBe("first_name");
  });

  it("detects and binds to embedded application iframe when main page has 0 fields", async () => {

    const mockFrame = {
      url: () => "https://job-boards.greenhouse.io/embed/job_app?for=testco&token=123",
      evaluate: async (fn: any) => {
        // Return plausible application fields from the iframe
        return [
          {
            field_id: "first_name",
            label: "First Name",
            type: "text",
            required: true,
            selector: "#first_name",
          },
          {
            field_id: "last_name",
            label: "Last Name",
            type: "text",
            required: true,
            selector: "#last_name",
          },
          {
            field_id: "email",
            label: "Email",
            type: "email",
            required: true,
            selector: "#email",
          },
          {
            field_id: "resume",
            label: "Attach Resume",
            type: "file",
            required: true,
            selector: "#resume",
          },
        ];
      },
    };

    const mockPage: any = {
      evaluate: async () => [], // Top-level document has 0 fields
      url: () => "https://careers.example.com/positions/123",
      rawPage: {
        evaluate: async () => [],
        mainFrame: () => mockPage,
        frames: () => [mockPage, mockFrame],
      },
    };

    const fields = await detectApplicationFields(mockPage);

    expect(fields.length).toBe(4);
    expect(fields.some((f) => f.field_id === "first_name")).toBe(true);
    expect(fields.some((f) => f.field_id === "resume")).toBe(true);
    expect(mockPage.activeFrame).toBe(mockFrame);
  });

  it("correctly identifies authentication walls and login redirects", async () => {
    const authUrls = [
      "https://account.ycombinator.com/authenticate?continue=https%3A%2F%2Fworkatastartup.com",
      "https://accounts.google.com/signin/v2",
      "https://auth.example.com/login",
      "https://careers.company.com/sign-in?returnTo=/apply",
    ];

    for (const url of authUrls) {
      const mockPage = {
        evaluate: async () => false,
        url: () => url,
        rawPage: { url: () => url },
      };
      const isLogin = await detectLoginRequired(mockPage);
      expect(isLogin).toBe(true);
    }
  });
});
