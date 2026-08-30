const base = process.env.BASE_URL ?? "http://127.0.0.1:3020";
const paths = ["/", "/stores", "/search?q=dress"];
const levels = [100, 250, 500, 1000];

for (const concurrency of levels) {
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: concurrency }, (_, i) => {
    const t = Date.now();
    return fetch(`${base}${paths[i % paths.length]}`, { signal: AbortSignal.timeout(15000) })
      .then((response) => ({ status: response.status, ms: Date.now() - t }))
      .catch(() => ({ status: 0, ms: Date.now() - t }));
  }));
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p) - 1)];
  const successful = results.filter((r) => r.status >= 200 && r.status < 400).length;
  console.log(JSON.stringify({
    concurrency,
    elapsedMs: Date.now() - started,
    avgMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    failed: results.length - successful,
    failureRate: Number(((results.length - successful) / results.length).toFixed(4)),
  }));
}
