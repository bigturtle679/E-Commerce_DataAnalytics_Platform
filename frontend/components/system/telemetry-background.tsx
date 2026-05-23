"use client";

export function TelemetryBackground({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 m-telemetry-bg opacity-30" />
      {/* Scanning line overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute left-0 right-0 h-px opacity-20"
          style={{
            background: "linear-gradient(90deg, transparent, var(--primary), transparent)",
            animation: "scan-line 6s ease-in-out infinite",
          }}
        />
      </div>
      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, var(--background), transparent)",
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to top, var(--background), transparent)",
        }}
      />
    </div>
  );
}
