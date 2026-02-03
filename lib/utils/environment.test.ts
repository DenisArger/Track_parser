import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isServerlessEnvironment,
  getSafeWorkingDirectory,
} from "./environment";

describe("isServerlessEnvironment", () => {
  const serverlessVars = [
    "NETLIFY",
    "NETLIFY_DEV",
    "NETLIFY_URL",
    "VERCEL",
    "AWS_LAMBDA_FUNCTION_NAME",
    "FUNCTION_NAME",
  ];

  beforeEach(() => {
    serverlessVars.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when NETLIFY is set", () => {
    process.env.NETLIFY = "1";
    expect(isServerlessEnvironment()).toBe(true);
  });

  it("returns true when VERCEL is set", () => {
    process.env.VERCEL = "1";
    expect(isServerlessEnvironment()).toBe(true);
  });

  it("returns true when AWS_LAMBDA_FUNCTION_NAME is set", () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "my-fn";
    expect(isServerlessEnvironment()).toBe(true);
  });

  it("returns true when NETLIFY_URL is set", () => {
    process.env.NETLIFY_URL = "https://x.netlify.app";
    expect(isServerlessEnvironment()).toBe(true);
  });

  it("returns true when FUNCTION_NAME is set", () => {
    process.env.FUNCTION_NAME = "fn";
    expect(isServerlessEnvironment()).toBe(true);
  });

  it("returns false when no serverless vars are set", () => {
    expect(isServerlessEnvironment()).toBe(false);
  });
});

describe("getSafeWorkingDirectory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NETLIFY = "";
    delete process.env.NETLIFY;
    delete process.env.TMPDIR;
  });

  it("returns TMPDIR when in serverless", () => {
    process.env.NETLIFY = "1";
    process.env.TMPDIR = "/custom/tmp";
    expect(getSafeWorkingDirectory()).toBe("/custom/tmp");
  });

  it("returns /tmp when in serverless and TMPDIR unset", () => {
    process.env.NETLIFY = "1";
    expect(getSafeWorkingDirectory()).toBe("/tmp");
  });

  it("returns cwd when not serverless", () => {
    expect(getSafeWorkingDirectory()).toBe(process.cwd());
  });
});
