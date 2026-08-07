# Product Requirements Document (PRD) - Openned

## 1. Vision
Openned is an AI-powered Developer Career Operating System. It goes beyond a simple resume builder by analyzing a developer's complete technical identity to create a verified Developer Knowledge Graph. 

## 2. Target Audience
Software Engineers, Data Scientists, DevOps Engineers, and Tech Professionals who want to optimize their career trajectory, manage job applications, and showcase their true capabilities through code and contributions rather than just self-reported resumes.

## 3. Core Features
- **Developer Knowledge Graph**: Aggregates data from GitHub, LinkedIn, Portfolio, LeetCode, HackerRank, etc., to form a holistic view of skills and experience.
- **Skill Extractor & Analyzer**: AI-driven extraction of verified skills based on actual code repositories, PRs, and problem-solving platforms.
- **ATS-Friendly Resume Optimizer**: Generates highly targeted, ATS-optimized resumes based on the specific job description and the developer's knowledge graph.
- **Job Matcher & Application Tracker**: AI matches the developer's verified skills with job postings and tracks the application pipeline (Kanban style).
- **Email Analyzer**: Parses emails from recruiters/companies to automatically update application statuses and schedule interviews.
- **Interview Assistant & Learning Engine**: Recommends learning paths based on missing skills for target roles and prepares tailored interview questions based on the job description and the user's weaknesses.
- **Career Analytics**: Insights into profile views, skill demand trends (Trending Skills Engine), and career progression.

## 4. Non-Functional Requirements
- **Scalability**: Must handle high volumes of background processing (webhooks, repository parsing, AI inference).
- **Performance**: Sub-second UI response times; background processing for heavy AI tasks.
- **Security**: OAuth for all integrations, encrypted tokens, strict PII data handling, rate limiting.
- **Maintainability**: Strict adherence to Clean Architecture, SOLID principles, and a Monorepo structure.
