/**
 * Get current timestamp in ISO 8601 format using system timezone
 * @returns ISO 8601 formatted string in local timezone (e.g., "2025-11-23T18:08:31.916+08:00")
 */
export function getLocalISOString(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (Math.abs(offset) % 60).toString().padStart(2, "0");
  const timezone = `${sign}${hours}:${minutes}`;

  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours_local = now.getHours().toString().padStart(2, "0");
  const minutes_local = now.getMinutes().toString().padStart(2, "0");
  const seconds_local = now.getSeconds().toString().padStart(2, "0");
  const milliseconds = now.getMilliseconds().toString().padStart(3, "0");

  return `${year}-${month}-${day}T${hours_local}:${minutes_local}:${seconds_local}.${milliseconds}${timezone}`;
}
