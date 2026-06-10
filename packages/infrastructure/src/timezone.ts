/**
 * Timezone converter utility.
 * Parses a local date/time string with a given timezone (e.g. "America/Sao_Paulo")
 * and converts it to a normalized UTC Date object.
 */
export function convertLocalToUTC(
  localDateTimeStr: string,
  timezone: string,
): Date {
  // Normalize ISO format slightly if present (e.g. replacing 'T' with space)
  const normalizedStr = localDateTimeStr.replace("T", " ");
  // Expected format: YYYY-MM-DD HH:MM
  const match = normalizedStr.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
  );
  if (!match) {
    throw new Error(
      `Invalid local date/time format: "${localDateTimeStr}". Expected format: YYYY-MM-DD HH:MM`,
    );
  }

  const y = match[1] ?? "";
  const m = match[2] ?? "";
  const d = match[3] ?? "";
  const h = match[4] ?? "";
  const min = match[5] ?? "";

  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  const hour = parseInt(h, 10);
  const minute = parseInt(min, 10);

  // Treat the local date parts as UTC initially
  const testUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));

  try {
    // Format the test UTC date in the target timezone to determine the offset
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(testUtc);
    const partMap: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        partMap[part.type] = parseInt(part.value, 10);
      }
    }

    const targetYear = partMap.year ?? 0;
    const targetMonth = partMap.month ?? 1;
    const targetDay = partMap.day ?? 1;
    const targetHour = partMap.hour === 24 ? 0 : (partMap.hour ?? 0);
    const targetMinute = partMap.minute ?? 0;

    const targetUtc = new Date(
      Date.UTC(
        targetYear,
        targetMonth - 1,
        targetDay,
        targetHour,
        targetMinute,
      ),
    );

    const offsetMs = testUtc.getTime() - targetUtc.getTime();

    return new Date(testUtc.getTime() + offsetMs);
  } catch (error) {
    throw new Error(`Failed to convert timezone: ${(error as Error).message}`);
  }
}
