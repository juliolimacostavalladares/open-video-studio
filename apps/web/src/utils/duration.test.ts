import { describe, expect, it } from "vitest";

import { calculateEstimatedDuration } from "./duration";

describe("calculateEstimatedDuration (client-side)", () => {
  it("returns zeros for empty, null, or whitespace-only inputs", () => {
    expect(calculateEstimatedDuration(null)).toEqual({ min: 0, max: 0, average: 0 });
    expect(calculateEstimatedDuration("")).toEqual({ min: 0, max: 0, average: 0 });
    expect(calculateEstimatedDuration("   \n  \t ")).toEqual({ min: 0, max: 0, average: 0 });
  });

  it("calculates correct duration for a known word count (140 words)", () => {
    const text = Array(140).fill("word").join(" ");
    expect(calculateEstimatedDuration(text)).toEqual({
      min: 56,
      max: 65,
      average: 60
    });
  });

  it("removes square-bracketed scene markers and only counts spoken text", () => {
    const spokenText = Array(140).fill("word").join(" ");
    const textWithMarkers = `[CENA 1 - Intro]\n${spokenText}\n[CENA 2]`;

    expect(calculateEstimatedDuration(textWithMarkers)).toEqual({
      min: 56,
      max: 65,
      average: 60
    });
  });

  it("handles empty spoken text with markers correctly", () => {
    expect(calculateEstimatedDuration("[CENA 1]")).toEqual({ min: 0, max: 0, average: 0 });
  });
});
