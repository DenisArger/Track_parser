"use client";

interface SpinnerProps {
  label?: string;
  className?: string;
}

export default function Spinner({ label = "Loading", className = "" }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <svg
        className="h-4 w-4 animate-spin text-current"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
