import http from "http";
import { AddressInfo } from "net";

export interface MockEmployerServer {
  server: http.Server;
  port: number;
  baseUrl: string;
  submitCount: number;
  close: () => Promise<void>;
}

export async function startMockEmployerServer(): Promise<MockEmployerServer> {
  let submitCount = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "POST" && (url.pathname === "/submit" || url.pathname === "/submit-success")) {
      submitCount++;
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Application Submitted</title></head>
            <body>
              <div id="confirmation-banner" class="success-message">
                <h1>Thank you for applying!</h1>
                <p>Your application has been received successfully.</p>
                <div class="application-id">Confirmation Number: APP-987654</div>
              </div>
            </body>
          </html>
        `);
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/submit-hang-then-verify") {
      submitCount++;
      // Respond with successful confirmation page after click
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Thank you for your application</title></head>
          <body>
            <h1>Thank you for applying!</h1>
            <p>Application successfully submitted. Reference: CONF-112233</p>
          </body>
        </html>
      `);
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });

    switch (url.pathname) {
      case "/standard-job":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Job Application - Acme Corp</title></head>
            <body>
              <h1>Software Engineer Application</h1>
              <form id="application-form" action="/submit" method="POST" enctype="multipart/form-data">
                <div>
                  <label for="first_name">First Name *</label>
                  <input type="text" id="first_name" name="first_name" required />
                </div>
                <div>
                  <label for="last_name">Last Name *</label>
                  <input type="text" id="last_name" name="last_name" required />
                </div>
                <div>
                  <label for="email">Email *</label>
                  <input type="email" id="email" name="email" required />
                </div>
                <div>
                  <label for="phone">Phone Number *</label>
                  <input type="tel" id="phone" name="phone" required />
                </div>
                <div>
                  <label for="resume">Resume / CV *</label>
                  <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx" />
                </div>
                <div>
                  <label for="why_interested">Why are you interested in this role at Acme Corp? *</label>
                  <textarea id="why_interested" name="why_interested" rows="4" required></textarea>
                </div>
                <button type="submit" id="submit-application">Submit Application</button>
              </form>
            </body>
          </html>
        `);
        break;

      case "/missing-profile-job":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Job Application - Missing Profile Info Required</title></head>
            <body>
              <h1>Design Lead Application</h1>
              <form id="application-form" action="/submit" method="POST">
                <label for="first_name">First Name *</label>
                <input type="text" id="first_name" name="first_name" required />
                <label for="last_name">Last Name *</label>
                <input type="text" id="last_name" name="last_name" required />
                <label for="email">Email *</label>
                <input type="email" id="email" name="email" required />
                <label for="portfolio_url">Portfolio URL *</label>
                <input type="url" id="portfolio_url" name="portfolio_url" required />
                <button type="submit" id="submit-application">Submit Application</button>
              </form>
            </body>
          </html>
        `);
        break;

      case "/captcha-job":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Security Check Required</title></head>
            <body>
              <h1>Please verify you are human</h1>
              <div class="g-recaptcha" data-sitekey="6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-"></div>
              <input type="text" id="name" name="name" />
            </body>
          </html>
        `);
        break;

      case "/login-job":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Sign In Required</title></head>
            <body>
              <div class="auth-box">
                <h2>Sign in to apply to this position</h2>
                <p>You must have an employer account to view and submit this form.</p>
                <a href="/login">Log In</a>
              </div>
            </body>
          </html>
        `);
        break;

      case "/rate-limited-job":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>429 Too Many Requests</title></head>
            <body>
              <h1>Rate limit exceeded</h1>
              <p>Too many requests. You have been temporarily blocked from accessing this service.</p>
            </body>
          </html>
        `);
        break;

      case "/unsupported-platform-job":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Internal Portal</title></head>
            <body>
              <h1>Internal Portal Only</h1>
              <p>This portal does not accept external applications. Internal employees only.</p>
            </body>
          </html>
        `);
        break;

      case "/multistep-step1":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Application Step 1</title></head>
            <body>
              <div class="step-indicator">Step 1 of 2</div>
              <form action="/multistep-step2" method="GET">
                <label for="first_name">First Name *</label>
                <input type="text" id="first_name" name="first_name" required />
                <label for="email">Email *</label>
                <input type="email" id="email" name="email" required />
                <button type="submit" id="next-step">Next Step</button>
              </form>
            </body>
          </html>
        `);
        break;

      case "/multistep-step2":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Application Step 2</title></head>
            <body>
              <div class="step-indicator">Step 2 of 2</div>
              <form action="/submit" method="POST">
                <label for="clearance_level">Security Clearance Level *</label>
                <input type="text" id="clearance_level" name="clearance_level" required />
                <button type="submit" id="submit-application">Submit Application</button>
              </form>
            </body>
          </html>
        `);
        break;

      case "/disappearing-field-job":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Disappearing Field Job</title></head>
            <head><title>Vanishing Field Job</title></head>
            <body>
              <form id="application-form" action="/submit" method="POST">
                <input type="text" id="vanished_field" name="vanished_field" required />
              </form>
              <script>
                // Remove the field shortly after detection
                setTimeout(() => {
                  const el = document.getElementById('vanished_field');
                  if (el) el.remove();
                }, 300);
              </script>
            </body>
          </html>
        `);
        break;

      case "/page-with-navbar-search":
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>LinkedIn Job - Frontend Software Engineer</title></head>
            <body>
              <header class="global-nav">
                <input type="search" placeholder="Search job titles or companies" name="search_query" />
                <input type="text" placeholder="Search skills, subjects, or software" name="skills_query" />
                <input type="text" placeholder="Add a filter" name="filter_input" />
                <input type="password" placeholder="Password" name="session_password" />
              </header>
              <main>
                <div class="jobs-easy-apply-modal">
                  <form id="application-form">
                    <label for="first_name">First Name *</label>
                    <input type="text" id="first_name" name="first_name" required />
                    <label for="phone">Phone *</label>
                    <input type="tel" id="phone" name="phone" required />
                  </form>
                </div>
              </main>
            </body>
          </html>
        `);
        break;

      default:
        res.end(`<!DOCTYPE html><html><body><h1>Job Board</h1></body></html>`);
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    server,
    port,
    baseUrl,
    get submitCount() { return submitCount; },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}
