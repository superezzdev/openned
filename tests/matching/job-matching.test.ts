import { describe, it, expect } from "vitest";
import { buildUserCareerProfile } from "../../src/lib/matching/career-profile-builder";
import { normalizeJob } from "../../src/lib/matching/job-normalizer";
import { scoreJob, rankJobsForUser } from "../../src/lib/matching/matcher";
import { generateSearchQueries } from "../../src/lib/matching/query-generator";
import { UserCareerProfile, NormalizedJob } from "../../src/lib/matching/types";

describe("Tailored Job Matching Engine - Verified Profile Test Suite", () => {
  // Kavya Gupta's verified profile fixture
  const verifiedProfileRaw = {
    userId: "f0d2357f-7cd6-4ee6-9eff-6f9a84a777af",
    profile: {
      id: "405ade99-f6f4-42ba-adb3-86279fd0ef33",
      first_name: "Kavya",
      last_name: "Gupta",
      location: "Chandigarh, India",
      summary: "Full Stack Developer specializing in MERN stack.",
      profile_version: 1,
    },
    skills: [
      { skill_name: "C" },
      { skill_name: "C++" },
      { skill_name: "HTML" },
      { skill_name: "Javascript" },
      { skill_name: "SQL" },
      { skill_name: "ReactJs" },
      { skill_name: "NodeJs" },
      { skill_name: "ExpressJS" },
      { skill_name: "TailwindCSS" },
      { skill_name: "Bootstrap" },
      { skill_name: "MongoDB" },
      { skill_name: "MySQL" },
      { skill_name: "Git" },
      { skill_name: "Github" },
      { skill_name: "Metabase" },
      { skill_name: "Linux" },
      { skill_name: "Shell Scripting" },
      { skill_name: "DSA" },
      { skill_name: "OS" },
      { skill_name: "Networks" },
      { skill_name: "Software Engineering" },
      { skill_name: "OOP" },
    ],
    experiences: [
      {
        job_title: "SWE Summer Intern",
        company_name: "Cisco Systems",
        duration: "June 2024 - July 2024",
        is_current: false,
      },
      {
        job_title: "FullStack Developer (MERN)",
        company_name: "Rework.ai",
        duration: "August 2023 - December 2023",
        is_current: false,
      },
    ],
    educations: [
      {
        degree: "Bachelor of Engineering",
        field_of_study: "Computer Science and Engineering",
        institution: "UIETH Panjab University",
        start_date: "Nov 2021",
        end_date: "July 2025",
      },
    ],
    projects: [
      {
        name: "SPEAKINDIA",
        description: "Full stack MERN application with React, Node, Express, MongoDB",
        technologies: ["React", "NodeJs", "ExpressJs", "MongoDB"],
      },
      {
        name: "OS LAB SIMULATOR",
        description: "Operating systems simulator built with React and Javascript",
        technologies: ["React", "Javascript"],
      },
    ],
  };

  const userCareerProfile: UserCareerProfile = buildUserCareerProfile(verifiedProfileRaw);

  describe("1. Career Profile Normalization & Zero Hallucination", () => {
    it("correctly derives ENTRY_LEVEL seniority from verified duration (7 months)", () => {
      expect(userCareerProfile.total_verified_experience_months).toBe(7);
      expect(userCareerProfile.seniority).toBe("ENTRY_LEVEL");
    });

    it("separates professional experience from project experience", () => {
      const projTech = userCareerProfile.projects.flatMap((p) => p.technologies).map((t) => t.toLowerCase());
      expect(projTech).toContain("react");
      expect(projTech).toContain("mongodb");
      // Verified experience companies only contain real employers
      const companies = userCareerProfile.experience.map((e) => e.company.toLowerCase());
      expect(companies).toEqual(["cisco systems", "rework.ai"]);
    });

    it("identifies target roles based on verified experience, education, and stack", () => {
      const targetRolesLower = userCareerProfile.target_roles.map((r) => r.toLowerCase());
      expect(targetRolesLower).toContain("software engineer");
      expect(targetRolesLower).toContain("full stack developer");
      expect(targetRolesLower).toContain("mern developer");
    });

    it("groups skills accurately without hallucinating unverified skills", () => {
      const techSkillsLower = userCareerProfile.technical_skills.map((s) => s.toLowerCase());
      expect(techSkillsLower).toContain("c++");
      const frameworksLower = userCareerProfile.frameworks.map((f) => f.toLowerCase());
      expect(frameworksLower).toContain("reactjs");
      expect(frameworksLower).toContain("nodejs");
      const dbLower = userCareerProfile.databases.map((d) => d.toLowerCase());
      expect(dbLower).toContain("mongodb");
      expect(dbLower).toContain("mysql");
      // Does not contain unverified Python, Java, AWS, Kubernetes, etc.
      const allSkillsLower = userCareerProfile.all_skills.map((s) => s.toLowerCase());
      expect(allSkillsLower).not.toContain("python");
      expect(allSkillsLower).not.toContain("java");
      expect(allSkillsLower).not.toContain("kubernetes");
    });
  });

  describe("2. Search Query Generation (Section 26)", () => {
    it("generates high-precision queries from verified roles and top skills", () => {
      const queries = generateSearchQueries(userCareerProfile);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries).toContain("entry level full stack developer");
      expect(queries).toContain("junior software engineer react node");
      expect(queries).toContain("MERN developer");
      // Does not generate single weak isolated keywords like "C Developer"
      expect(queries).not.toContain("c developer");
    });
  });

  describe("3. Section 28 - Benchmark Evaluation Test Cases", () => {
    // 10 test job fixtures
    const job1_juniorReact = normalizeJob({
      id: "j1",
      title: "Junior React Developer",
      company_name: "TechStart Labs",
      description: "Looking for a Junior React Developer to build responsive user interfaces using React, JavaScript, HTML, and CSS. 0-2 years experience required. Computer Science degree preferred.",
      location: "Remote",
    });

    const job2_entryNode = normalizeJob({
      id: "j2",
      title: "Entry Level Node.js Developer",
      company_name: "BackendCloud",
      description: "Join our API team as an Entry Level Backend Developer working with Node.js, Express, and SQL databases. New grads and entry level candidates welcome. Mentorship provided.",
      location: "Remote",
    });

    const job3_mernFullStack = normalizeJob({
      id: "j3",
      title: "Full Stack MERN Developer",
      company_name: "SaaS Rocket",
      description: "Seeking a Full Stack Developer experienced with the MERN stack (MongoDB, Express, React, Node.js). Build end-to-end features, REST APIs, and modern UIs. 1+ year experience.",
      location: "Remote",
    });

    const job4_seniorJava = normalizeJob({
      id: "j4",
      title: "Senior Java Backend Engineer",
      company_name: "Enterprise Core",
      description: "We are looking for a Senior Java Backend Engineer with 8+ years of enterprise experience in Spring Boot, microservices architecture, and distributed systems. Lead engineering teams.",
      location: "Remote",
    });

    const job5_dataScientist = normalizeJob({
      id: "j5",
      title: "Data Scientist (Python, ML)",
      company_name: "AI Analytics Corp",
      description: "Seeking a Data Scientist to build deep learning models and predictive analytics pipelines using Python, PyTorch, Scikit-Learn, and Pandas. Masters or PhD in Statistics/ML required.",
      location: "Remote",
    });

    const job6_marketingManager = normalizeJob({
      id: "j6",
      title: "Marketing Manager",
      company_name: "Growth Scale Media",
      description: "Lead our digital marketing campaigns, SEO, paid acquisition, and brand strategy. Experience with Google Ads, HubSpot, and social media marketing.",
      location: "Remote",
    });

    const job7_financialAnalyst = normalizeJob({
      id: "j7",
      title: "Financial Analyst",
      company_name: "Global Capital Group",
      description: "Analyze financial statements, build Excel models, forecast cash flow, and present quarterly revenue projections. CFA or CPA preferred.",
      location: "Remote",
    });

    const job8_uiUxDesigner = normalizeJob({
      id: "j8",
      title: "UI/UX Product Designer",
      company_name: "PixelCraft Studios",
      description: "Create wireframes, prototypes, and user journeys in Figma. Conduct user research and usability testing. Portfolio required.",
      location: "Remote",
    });

    const job9_devopsKubernetes = normalizeJob({
      id: "j9",
      title: "DevOps Engineer (Kubernetes, Terraform)",
      company_name: "InfraGrid Solutions",
      description: "Maintain CI/CD pipelines, Kubernetes clusters, Terraform infrastructure, and AWS cloud environments. 4+ years DevOps experience required.",
      location: "Remote",
    });

    const job10_sweReactNode = normalizeJob({
      id: "j10",
      title: "Software Engineer (React, Node)",
      company_name: "Modern Web Apps",
      description: "We are hiring an Associate / Junior Software Engineer with practical experience in React, Node.js, and SQL. Build client-facing web applications.",
      location: "Remote",
    });

    it("1. Junior React Developer -> High Match", () => {
      const score = scoreJob(userCareerProfile, job1_juniorReact);
      expect(score.passed_hard_filter).toBe(true);
      expect(score.score).toBeGreaterThanOrEqual(75);
      expect(score.match_level).toMatch(/Strong|Excellent/);
      expect(score.matched_skills.map((s) => s.toLowerCase())).toContain("react");
    });

    it("2. Entry-Level Node Developer -> High Match", () => {
      const score = scoreJob(userCareerProfile, job2_entryNode);
      expect(score.passed_hard_filter).toBe(true);
      expect(score.score).toBeGreaterThanOrEqual(70);
      expect(score.match_level).toMatch(/Strong|Excellent|Good/);
    });

    it("3. Full Stack MERN Developer -> Very High Match", () => {
      const score = scoreJob(userCareerProfile, job3_mernFullStack);
      expect(score.passed_hard_filter).toBe(true);
      expect(score.score).toBeGreaterThanOrEqual(85);
      expect(score.match_level).toBe("Excellent");
      expect(score.reasons.length).toBeGreaterThan(0);
      // Explanation mentions verified skills
      expect(score.reasons[0].toLowerCase()).toMatch(/react|node|mern|full-stack/);
    });

    it("4. Senior Java Backend Engineer -> Strongly suppressed / excluded by seniority protection", () => {
      const score = scoreJob(userCareerProfile, job4_seniorJava);
      // Must fail hard filter or score < 30
      expect(score.passed_hard_filter).toBe(false);
      expect(score.reasons.some((r) => r.includes("seniority") || r.includes("Senior"))).toBe(true);
    });

    it("5. Data Scientist (Python, ML) -> Low Match / excluded (missing required stack)", () => {
      const score = scoreJob(userCareerProfile, job5_dataScientist);
      expect(score.score).toBeLessThan(45);
      expect(score.missing_requirements).toEqual(
        expect.arrayContaining([expect.stringMatching(/python|machine learning|data science/i)])
      );
    });

    it("6. Marketing Manager -> Excluded (wrong field / role family hard filter)", () => {
      const score = scoreJob(userCareerProfile, job6_marketingManager);
      expect(score.passed_hard_filter).toBe(false);
      expect(score.score).toBeLessThan(40);
    });

    it("7. Financial Analyst -> Excluded (wrong field / role family hard filter)", () => {
      const score = scoreJob(userCareerProfile, job7_financialAnalyst);
      expect(score.passed_hard_filter).toBe(false);
      expect(score.score).toBeLessThan(40);
    });

    it("8. UI/UX Designer -> Low Match / excluded for software engineering profile", () => {
      const score = scoreJob(userCareerProfile, job8_uiUxDesigner);
      expect(score.score).toBeLessThan(45);
    });

    it("9. DevOps Engineer (Kubernetes, Terraform) -> Low Match / excluded", () => {
      const score = scoreJob(userCareerProfile, job9_devopsKubernetes);
      expect(score.score).toBeLessThan(45);
    });

    it("10. Software Engineer (React, Node) -> High Match", () => {
      const score = scoreJob(userCareerProfile, job10_sweReactNode);
      expect(score.passed_hard_filter).toBe(true);
      expect(score.score).toBeGreaterThanOrEqual(75);
      expect(score.match_level).toMatch(/Strong|Excellent/);
    });

    it("Golden Rule: Target engineering roles MUST rank strictly above irrelevant or senior roles", () => {
      const allJobs = [
        job1_juniorReact,
        job2_entryNode,
        job3_mernFullStack,
        job4_seniorJava,
        job5_dataScientist,
        job6_marketingManager,
        job7_financialAnalyst,
        job8_uiUxDesigner,
        job9_devopsKubernetes,
        job10_sweReactNode,
      ];

      const ranked = rankJobsForUser(userCareerProfile, allJobs, { minThreshold: 45 });

      // All returned jobs must be >= 45 and pass hard filters
      for (const item of ranked) {
        expect(item.score.score).toBeGreaterThanOrEqual(45);
        expect(item.score.passed_hard_filter).toBe(true);
      }

      // The top ranked jobs must be Job 3 (MERN), Job 10 (SWE React Node), Job 1 (Junior React), Job 2 (Entry Node)
      const rankedIds = ranked.map((r) => r.job.id);
      expect(rankedIds).toContain("j3");
      expect(rankedIds).toContain("j10");
      expect(rankedIds).toContain("j1");
      expect(rankedIds).toContain("j2");

      // Senior Java, Data Scientist, Marketing, Finance, Designer, DevOps MUST NOT be in the recommendation feed!
      expect(rankedIds).not.toContain("j4"); // Senior Java
      expect(rankedIds).not.toContain("j5"); // Data Scientist
      expect(rankedIds).not.toContain("j6"); // Marketing Manager
      expect(rankedIds).not.toContain("j7"); // Financial Analyst
      expect(rankedIds).not.toContain("j8"); // UI/UX Designer
      expect(rankedIds).not.toContain("j9"); // DevOps Kubernetes
    });
  });

  describe("4. Company Diversity & Feedback Suppression", () => {
    it("limits duplicate companies to max 4 on top results", () => {
      const manySameCompanyJobs: NormalizedJob[] = Array.from({ length: 8 }).map((_, i) =>
        normalizeJob({
          id: `same-co-${i}`,
          title: `Software Engineer ${i}`,
          company_name: "MegaCorp Tech",
          description: "Full stack engineer working on React and Node.",
          location: "Remote",
        })
      );

      const otherJob = normalizeJob({
        id: "other-co-1",
        title: "Frontend Developer",
        company_name: "Independent Labs",
        description: "React web developer position.",
        location: "Remote",
      });

      const ranked = rankJobsForUser(userCareerProfile, [...manySameCompanyJobs, otherJob], {
        maxPerCompany: 4,
        minThreshold: 45,
      });

      const megaCorpCount = ranked.filter((r) => r.job.company.toLowerCase() === "megacorp tech").length;
      expect(megaCorpCount).toBeLessThanOrEqual(4);
      expect(ranked.some((r) => r.job.id === "other-co-1")).toBe(true);
    });

    it("completely filters out jobs marked not_relevant or hidden", () => {
      const relevantJob = normalizeJob({
        id: "j-hidden-test",
        title: "Full Stack Developer",
        company_name: "Startup X",
        description: "React and Node full stack position.",
        location: "Remote",
      });

      const interactionMap = new Map([
        [
          "j-hidden-test",
          { saved_status: false, applied_status: false, not_relevant: true, hidden: true },
        ],
      ]);

      const ranked = rankJobsForUser(userCareerProfile, [relevantJob], {
        userInteractions: interactionMap,
        minThreshold: 45,
      });

      expect(ranked.length).toBe(0);
    });
  });
});
