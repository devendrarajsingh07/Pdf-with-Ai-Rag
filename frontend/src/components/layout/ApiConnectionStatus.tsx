"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export default function ApiConnectionStatus() {
  const ping = useQuery({
    queryKey: ["api-connection"],
    queryFn: async () => {
      const result = await apiGet<{ service: string; apiVersion: string }>("/health/ping", { timeout: 5000 });
      if (result.service !== "documind-api" || result.apiVersion !== "v1") {
        throw new Error("Unexpected API response");
      }
      return result;
    },
    retry: false,
    staleTime: 15000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const label = ping.isPending ? "Connecting to API…" : ping.isError ? "API unavailable" : "API connected";
  return <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
    <span role="status" aria-live="polite">{label}</span>
    {ping.isError && <button type="button" className="text-primary underline underline-offset-4" disabled={ping.isFetching} onClick={() => void ping.refetch()}>
      {ping.isFetching ? "Checking…" : "Retry connection"}
    </button>}
  </div>;
}
