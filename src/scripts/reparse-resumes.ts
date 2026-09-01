import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { reparseResume, reparseAllResumes } from "@/lib/resume/reparse";

async function main() {
  const args = process.argv.slice(2);
  const targetUserId = args[0];

  console.log("=== ZERO-HALLUCINATION RESUME REPARSER ===");

  if (targetUserId && targetUserId !== "all") {
    console.log(`Reparsing resume for specific user: ${targetUserId}`);
    const result = await reparseResume(targetUserId);
    console.log("Reparse result:", JSON.stringify(result, null, 2));
  } else {
    console.log("Reparsing all user resumes in the database...");
    const results = await reparseAllResumes();
    console.log(`Reparsed ${results.length} users:`);
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch(console.error);
