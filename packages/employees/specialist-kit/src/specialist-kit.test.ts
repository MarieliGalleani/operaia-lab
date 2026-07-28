import { describe, expect, it } from "vitest";
import * as specialistKit from "./index";

describe("@operaia/specialist-kit", () => {
  it("should export specialist kit module", () => {
    expect(specialistKit).toBeDefined();
  });
});