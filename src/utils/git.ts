/**
 * Get the current Git revision
 * @returns short Git revision or "unknown" if not available
 */
export function getGitRevision(): string {
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
