import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { chromium, Browser, Page } from "playwright";
import http from "http";
import { AddressInfo } from "net";
import { detectApplicationFields } from "../../src/lib/applications/form-detector";

describe("Question Visibility & Label Extraction Hardening", () => {
  let server: http.Server;
  let baseUrl: string;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });

    server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });

      if (req.url === "/jobicy-style-page") {
        // Simulates an aggregator page like Jobicy with invisible clipboard inputs
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Jobicy Aggregator</title></head>
            <body>
              <h1>Business Strategy Analyst at Getlabs</h1>
              <input hidden type="checkbox" id="themeSwitchInput">
              <input type="text" class="ctext" style="opacity:0;position:absolute;pointer-events:none" readonly value="https://jobicy.com/jobs/152238" />
              <button class="jv-apply-primary">Apply Now</button>
            </body>
          </html>
        `);
      } else if (req.url === "/complex-ats-custom-questions") {
        // Simulates an employer ATS (like Greenhouse / Ashby / Lever) with custom questions
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Getlabs Careers</title></head>
            <body>
              <form id="application-form">
                <div class="field-wrapper">
                  <label for="first_name">First Name *</label>
                  <input type="text" id="first_name" name="first_name" required />
                </div>
                <div class="field-wrapper">
                  <label for="last_name">Last Name *</label>
                  <input type="text" id="last_name" name="last_name" required />
                </div>
                <div class="field-wrapper">
                  <label for="email">Email *</label>
                  <input type="email" id="email" name="email" required />
                </div>
                <div class="field-wrapper">
                  <label for="resume">Resume / CV *</label>
                  <input type="file" id="resume" name="resume" required />
                </div>

                <!-- Custom question inside modern framework wrapper div without label for="id" -->
                <div class="field-wrapper application-question" data-testid="question-work-auth">
                  <div class="question-header">
                    <span class="question-text">Are you legally authorized to work in the United States? *</span>
                  </div>
                  <div class="input-control">
                    <input type="text" name="custom_question_9872" required />
                  </div>
                </div>

                <!-- Open ended question with container title -->
                <div class="form-group custom-field">
                  <h4 class="field-title">Why are you specifically interested in working at Getlabs? (Required)</h4>
                  <div class="text-wrap">
                    <textarea name="response_essay" rows="4" required></textarea>
                  </div>
                </div>
              </form>
            </body>
          </html>
        `);
      } else {
        res.end("<html><body>Not Found</body></html>");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  it("filters out invisible, readonly clipboard copy inputs (e.g. Jobicy .ctext inputs)", async () => {
    await page.goto(`${baseUrl}/jobicy-style-page`);
    const fields = await detectApplicationFields(page);

    // The invisible clipboard input must be ignored
    expect(fields.length).toBe(0);
    expect(fields.some(f => f.field_id === "unknown_field")).toBe(false);
  });

  it("correctly extracts full, human-readable question text from modern ATS container structures", async () => {
    await page.goto(`${baseUrl}/complex-ats-custom-questions`);
    const fields = await detectApplicationFields(page);

    expect(fields.length).toBe(6);

    // Question 1: Work authorization question inside wrapper
    const workAuthField = fields.find(f => f.selector?.includes("custom_question_9872"));
    expect(workAuthField).toBeDefined();
    expect(workAuthField?.label).toBe("Are you legally authorized to work in the United States?");
    expect(workAuthField?.label).not.toContain("Unknown Field");
    expect(workAuthField?.label).not.toContain("*");

    // Question 2: Why Getlabs essay inside form-group
    const essayField = fields.find(f => f.selector?.includes("response_essay"));
    expect(essayField).toBeDefined();
    expect(essayField?.label).toBe("Why are you specifically interested in working at Getlabs?");
    expect(essayField?.label).not.toContain("Unknown Field");
    expect(essayField?.label).not.toContain("(Required)");
  });
});
