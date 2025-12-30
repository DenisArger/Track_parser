import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Track Parser - Radio Track Preparation",
  description: "Automated radio track preparation application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/layout.tsx:14',message:'RootLayout entry',data:{hasProcess:typeof process!=='undefined',hasEnv:typeof process!=='undefined'&&!!process.env,nextPhase:typeof process!=='undefined'&&process.env?process.env.NEXT_PHASE:'N/A',nodeEnv:typeof process!=='undefined'&&process.env?process.env.NODE_ENV:'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  } catch (e) {
    console.error("[DEBUG] RootLayout: Error in debug log", e);
  }
  // #endregion
  // Ensure layout is a pure Server Component without any side effects
  // No imports or operations that might fail in serverless environment
  try {
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/layout.tsx:18',message:'RootLayout before return',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    } catch (e) {
      console.error("[DEBUG] RootLayout: Error in debug log 2", e);
    }
    // #endregion
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Track Parser
            </h1>
            <p className="text-gray-600">
              Automated radio track preparation and management
            </p>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
  } catch (error) {
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/layout.tsx:32',message:'RootLayout error',data:{errorMessage:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    } catch (e) {
      console.error("[DEBUG] RootLayout: Error in debug log 3", e);
    }
    // #endregion
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[DEBUG] RootLayout: Error in layout", {
      errorMessage,
      errorStack,
      nodeEnv: typeof process !== "undefined" && process.env ? process.env.NODE_ENV : "unknown",
      netlify: typeof process !== "undefined" && process.env ? process.env.NETLIFY : "unknown"
    });
    throw error;
  }
}
