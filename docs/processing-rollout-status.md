# Processing rollout — 19 September 2026

## Installed / implemented

- Five-minute public collection with per-source due times, exclusive leases, content-hash reuse and failure backoff.
- Versioned public job envelopes, evidence revision identifiers, bounded leases and stale-result rejection.
- Admin processing dashboard and five-minute historical queue/publication samples, retained for 30 days.
- Local model registry with exact SHA-256 identity; role routing rejects unapproved candidates.
- Independent model supervisor: loopback-only endpoint, managed-child lifecycle, a 3 GB available-memory reserve plus model allowance, health checks, five-minute idle unload, exclusive News inference, and no authority to stop the existing system model service.
- Cache identity includes model digest, quantization, task, request, prompt and schema version. Disposable cache retention is 30 days / 5,000 entries.
- Isolated benchmark runner and 42 frozen cases, including ten non-English cases, evidence revision and prompt injection. Raw fixtures and outputs are ignored by Git and excluded from Vercel uploads.
- Separate bounded telemetry relay; supervisor/benchmark services cannot read the News credential file. Benchmark service network is restricted to localhost.

## Models

Production remains Qwen3.5 2B Q4_K_M, treated as externally managed. Candidate: official Qwen3 0.6B Q8_0 (639,446,688 bytes), pinned Hugging Face revision `23749fefcc72300e3a2ad315e1317431b06b590a` and verified SHA-256. Candidate results cannot publish or trigger delivery. Bonsai 2 remains a potential separate-host experiment; it is not silently installed or promoted on the constrained Acer.

## Gates still open

- Full-day baseline and three scheduled publication cycles after this rollout.
- Completion of the paired 42-case evaluation and factual/attribution review. Schema validity and number matching alone cannot approve a model.
- Broader validation before a small production canary; no automatic candidate promotion.
- Unified persistent task-state migration, dependency heartbeat support and fair aging/deadline scheduling beyond the current priority/lease implementation.
- Complete permitted source-body acquisition and its source-by-source policy review. Existing generated pages remain labeled Summary and link to the full source article.
- Browser-state preservation inspection when computer-use access is available.

## Operations

Registry: Acer `~/.config/bittrees-news/models.json` (no tokens). Supervisor port 8092; managed candidate port 8093. Existing baseline port 8081 is unchanged. Model services and binaries are configured locally, never through a public job.

Benchmark fixtures/results: `~/.local/state/bittrees-news/benchmark/`. Results have `human_review: pending`; review them before any routing change. The benchmark resumes completed cases without repeating them. It is a one-shot service bounded to 24 hours, not a recurring publishing task.

New service names: `bittrees-news-models`, `bittrees-news-model-report`, `bittrees-news-benchmark`. Production workers keep their previous routing until registry integration is activated. A saved copy of editor configuration permits routing rollback without changing source data or editions.

Tests: TypeScript suite, Python registry/locking suite, database processing/collection integration checks, and live health/access checks. Follow-up checks must update this document with actual benchmark and cycle results; do not mark all phases complete from startup alone.
