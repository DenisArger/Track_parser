/**
 * Utility functions to detect environment and handle serverless-specific issues
 */

/**
 * Detects if running in serverless environment (Netlify, Vercel, etc.)
 * Checks for specific environment variables set by serverless platforms
 * Safe for Server Components - handles cases where process.env might not be available
 */
export function isServerlessEnvironment(): boolean {
  try {
    // Check if process.env is available
    if (typeof process === "undefined" || !process.env) {
      return false;
    }

    // Netlify sets NETLIFY=true in production (set in netlify.toml)
    if (process.env.NETLIFY) {
      return true;
    }

    // Netlify also sets NETLIFY_DEV in local dev, but we check for production
    // In Netlify production, NETLIFY=true is set
    if (process.env.NETLIFY_DEV === "true" && process.env.NETLIFY === "true") {
      return true;
    }

    // Check for Netlify runtime environment variables
    // NETLIFY_URL is set in production, but may not be available during build
    if (process.env.NETLIFY_URL) {
      return true;
    }

    // Vercel sets VERCEL=1 in production
    if (process.env.VERCEL) {
      return true;
    }

    // AWS Lambda
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return true;
    }

    // Generic serverless function indicator
    if (process.env.FUNCTION_NAME) {
      return true;
    }

    return false;
  } catch (error) {
    // If anything fails, assume not serverless to be safe
    return false;
  }
}

/**
 * Gets a safe working directory for file operations
 * In serverless, we might need to use /tmp or a different location
 * Safe for static generation - returns /tmp if process.cwd() is not available
 */
export function getSafeWorkingDirectory(): string {
  try {
    // Check if we're in a build-time environment
    if (typeof process === 'undefined' || !process.cwd) {
      return "/tmp";
    }
    
    // In serverless, /tmp is usually writable
    if (isServerlessEnvironment()) {
      const tmpDir = process.env.TMPDIR || process.env.TMP || "/tmp";
      return tmpDir;
    }
    
    // Try to get current working directory
    try {
      return process.cwd();
    } catch (error) {
      // If process.cwd() fails, use /tmp
      return "/tmp";
    }
  } catch (error) {
    // Fallback to /tmp if everything fails
    return "/tmp";
  }
}

/**
 * Checks if file system is writable
 * In serverless, file system might be read-only
 */
export async function isFileSystemWritable(dir?: string): Promise<boolean> {
  if (isServerlessEnvironment()) {
    // In serverless, we can usually write to /tmp
    const testDir = dir || getSafeWorkingDirectory();
    try {
      const fs = await import("fs-extra");
      const path = await import("path");
      const testFile = path.join(testDir, `.test-${Date.now()}.tmp`);
      await fs.writeFile(testFile, "test");
      await fs.remove(testFile);
      return true;
    } catch (error) {
      return false;
    }
  }
  return true;
}
