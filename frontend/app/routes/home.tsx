import { useEffect, useState } from "react";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "PINA" },
    { name: "description", content: "Private Image Network Archive" },
  ];
}

type HealthStatus = "loading" | "up" | "down";

export default function Home() {
  const [health, setHealth] = useState<HealthStatus>("loading");

  useEffect(() => {
    fetch("/api/v1/health")
      .then((res) => {
        setHealth(res.ok ? "up" : "down");
      })
      .catch(() => {
        setHealth("down");
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">PINA</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Private Image Network Archive
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm dark:border-gray-700">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              health === "loading"
                ? "bg-gray-400 animate-pulse"
                : health === "up"
                  ? "bg-green-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-gray-600 dark:text-gray-400">
            {health === "loading"
              ? "Connecting..."
              : health === "up"
                ? "Backend connected"
                : "Backend unavailable"}
          </span>
        </div>
      </div>
    </main>
  );
}
