const base = process.env.BASE_URL ?? "http://127.0.0.1:3020";
const levels = (process.env.CONCURRENCY ?? "100,250,500,1000").split(",").map(Number).filter(Number.isFinite);
const scenarios = [["homepage", "/"], ["categories", "/stores"], ["search", "/search?q=dress"], ["filtered-search", "/search?q=dress&sort=price-asc"], ["category", "/categories/kurtis"]];
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 15000);
const headers = process.env.COOKIE ? { cookie: process.env.COOKIE } : undefined;
const percentile = (values, p) => values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * p) - 1))];

for (const concurrency of levels) {
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: concurrency }, (_, i) => {
    const [scenario, path] = scenarios[i % scenarios.length];
    const t = Date.now();
    return fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) })
      .then((response) => ({ scenario, status: response.status, ms: Date.now() - t }))
      .catch((error) => ({ scenario, status: 0, ms: Date.now() - t, error: error?.name ?? "request_failed" }));
  }));
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p) - 1)];
  const successful = results.filter((r) => r.status >= 200 && r.status < 400).length;
  const byScenario = Object.fromEntries(scenarios.map(([name]) => {
    const rows = results.filter((r) => r.scenario === name);
    const values = rows.map((r) => r.ms).sort((a, b) => a - b);
    return [name, { requests: rows.length, avgMs: Math.round(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)), p95Ms: percentile(values, .95), p99Ms: percentile(values, .99), failureRate: Number((rows.filter((r) => r.status < 200 || r.status >= 400).length / Math.max(1, rows.length)).toFixed(4)) }];
  }));
  console.log(JSON.stringify({
    concurrency,
    elapsedMs: Date.now() - started,
    avgMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    failed: results.length - successful,
    failureRate: Number(((results.length - successful) / results.length).toFixed(4)),
    scenarios: byScenario,
  }));
}
