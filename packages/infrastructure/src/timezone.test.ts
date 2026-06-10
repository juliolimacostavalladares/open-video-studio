import { describe, expect, it } from "vitest";
import { convertLocalToUTC } from "./timezone.js";

describe("Timezone Converter utility", () => {
  it("converts America/Sao_Paulo time to UTC correctly (UTC-3)", () => {
    // June 10, 2026 at 12:00 local time
    const utcDate = convertLocalToUTC("2026-06-10 12:00", "America/Sao_Paulo");
    // Should be 15:00 UTC
    expect(utcDate.toISOString()).toBe("2026-06-10T15:00:00.000Z");
  });

  it("converts Europe/London time to UTC correctly (UTC+1 due to DST)", () => {
    // June 10, 2026 at 12:00 local time
    const utcDate = convertLocalToUTC("2026-06-10 12:00", "Europe/London");
    // Should be 11:00 UTC
    expect(utcDate.toISOString()).toBe("2026-06-10T11:00:00.000Z");
  });

  it("converts Asia/Tokyo time to UTC correctly (UTC+9)", () => {
    // June 10, 2026 at 12:00 local time
    const utcDate = convertLocalToUTC("2026-06-10 12:00", "Asia/Tokyo");
    // Should be 03:00 UTC
    expect(utcDate.toISOString()).toBe("2026-06-10T03:00:00.000Z");
  });

  it("handles standard ISO T separator format", () => {
    const utcDate = convertLocalToUTC("2026-06-10T12:00", "UTC");
    expect(utcDate.toISOString()).toBe("2026-06-10T12:00:00.000Z");
  });

  it("throws error for invalid date/time format", () => {
    expect(() => convertLocalToUTC("2026/06/10 12:00", "UTC")).toThrow(
      "Invalid local date/time format",
    );
    expect(() => convertLocalToUTC("10-06-2026 12:00", "UTC")).toThrow(
      "Invalid local date/time format",
    );
  });

  it("throws error for invalid timezone name", () => {
    expect(() =>
      convertLocalToUTC("2026-06-10 12:00", "Invalid/Timezone"),
    ).toThrow("Failed to convert timezone");
  });
});
