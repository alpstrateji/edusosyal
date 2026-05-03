import { describe, it, expect } from "vitest";
import { defaultRouteForRole, canAccessRoute, AGENCY_ONLY_ROUTES } from "./roleRouting";

describe("defaultRouteForRole", () => {
  it("agency_admin → /dashboard", () => {
    expect(defaultRouteForRole("agency_admin")).toBe("/dashboard");
  });
  it("school_admin → /leads", () => {
    expect(defaultRouteForRole("school_admin")).toBe("/leads");
  });
  it("null/undefined → /leads fallback", () => {
    expect(defaultRouteForRole(null)).toBe("/leads");
    expect(defaultRouteForRole(undefined)).toBe("/leads");
  });
});

describe("canAccessRoute", () => {
  it("agency_admin can access everything", () => {
    for (const r of AGENCY_ONLY_ROUTES) {
      expect(canAccessRoute("agency_admin", r)).toBe(true);
    }
    expect(canAccessRoute("agency_admin", "/leads")).toBe(true);
    expect(canAccessRoute("agency_admin", "/settings")).toBe(true);
  });

  it("school_admin blocked from agency-only routes", () => {
    for (const r of AGENCY_ONLY_ROUTES) {
      expect(canAccessRoute("school_admin", r)).toBe(false);
      expect(canAccessRoute("school_admin", `${r}/sub/page`)).toBe(false);
    }
  });

  it("school_admin can access shared routes", () => {
    expect(canAccessRoute("school_admin", "/leads")).toBe(true);
    expect(canAccessRoute("school_admin", "/logs")).toBe(true);
    expect(canAccessRoute("school_admin", "/settings")).toBe(true);
  });

  it("null role treated as non-agency", () => {
    expect(canAccessRoute(null, "/dashboard")).toBe(false);
    expect(canAccessRoute(null, "/leads")).toBe(true);
  });

  it("does not false-match similar prefixes", () => {
    // /campaigns is agency-only; /campaigns-archive should not be (hypothetical).
    expect(canAccessRoute("school_admin", "/campaigns-archive")).toBe(true);
  });
});
