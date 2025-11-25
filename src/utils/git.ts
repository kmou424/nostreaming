import { readFileSync } from "fs";

/**
 * Get the current Git revision
 * Priority:
 * 1. Read from VERSION file (for Docker builds)
 * 2. Execute git command (for local development)
 * @returns short Git revision or "unknown" if not available
 */
export function getGitRevision(): string {
  // Try to read from VERSION file first (for Docker builds)
  try {
    const content = readFileSync("VERSION", "utf-8").trim();
    if (content) {
      return content;
    }
  } catch {
    // VERSION file doesn't exist or can't be read, continue to git command
  }

  // Fallback to git command (for local development)
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.success && result.stdout) {
      const hash = new TextDecoder().decode(result.stdout).trim();
      return hash || "unknown";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
