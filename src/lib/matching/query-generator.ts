import { UserCareerProfile } from "./types";

/**
 * Generate targeted, high-precision search queries from verified user profile signals.
 * Replaces naive single-keyword or weak isolated signals.
 */
export function generateSearchQueries(user: UserCareerProfile): string[] {
  const queries = new Set<string>();
  const isEarlyCareer = user.seniority === "ENTRY_LEVEL" || user.seniority === "INTERN";
  const skillSet = new Set(user.all_skills.map((s) => s.toLowerCase()));

  const hasReact = skillSet.has("react") || skillSet.has("reactjs");
  const hasNode = skillSet.has("node") || skillSet.has("nodejs") || skillSet.has("node.js");
  const hasMongo = skillSet.has("mongodb");
  const hasFullStackExp = user.target_roles.some(
    (r) => r.toLowerCase().includes("full stack") || r.toLowerCase().includes("mern")
  );

  // 1. Core full-stack queries
  if (hasFullStackExp || (hasReact && hasNode)) {
    if (isEarlyCareer) {
      queries.add("entry level full stack developer");
      queries.add("junior software engineer react node");
      queries.add("junior full stack developer");
    } else {
      queries.add("full stack developer react node");
      queries.add("software engineer react node");
    }

    if (hasMongo) {
      queries.add("MERN developer");
      if (isEarlyCareer) {
        queries.add("junior MERN developer");
      }
    }
  }

  // 2. Frontend queries
  if (hasReact) {
    if (isEarlyCareer) {
      queries.add("junior frontend developer react");
      queries.add("entry level frontend developer");
    } else {
      queries.add("frontend developer react");
    }
  }

  // 3. Backend queries
  if (hasNode) {
    if (isEarlyCareer) {
      queries.add("junior backend developer node");
      queries.add("entry level backend developer");
    } else {
      queries.add("backend developer node");
    }
  }

  // 4. General Software Engineering queries
  if (isEarlyCareer) {
    queries.add("software engineer javascript react");
    queries.add("associate software engineer");
    queries.add("new grad software engineer");
  } else {
    queries.add("software engineer javascript");
  }

  return Array.from(queries);
}
