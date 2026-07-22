# Course Recommendation Engine Write-up

## 1. Approach and Trade-offs

I built this as a deterministic, rule-based engine rather than a learned model. With a synthetic dataset and no real feedback loop to validate against, a transparent scoring formula is easier to justify, test, and audit than a model I couldn't properly evaluate anyway.

`DefaultRecommendationService.recommendForUser` runs a fixed pipeline: fetch the user, `UserLearningContext`, latest `SurveyResponse`, usage history, and the full course catalog in parallel; filter to eligible courses via `DefaultCourseFilterService` (drops completed courses and any course whose prerequisites aren't fully completed); resolve the activity-segment weight vector via `DefaultRecommendationWeightService`; score every eligible course against three independent signals — profile, survey, usage — via `DefaultProfileScoringService`, `DefaultSurveyScoringService`, `DefaultUsageScoringService`; combine into a `final_score`; sort descending; slice to `limit`.

Each recommendation carries a detailed `reasons` array (signal-tagged evidence) for auditability and one deterministic `reason` sentence built from that evidence. When Gemini is configured and requested, `RecommendationAIEnrichmentService` rewrites `reason` into a friendlier `ai_reason` on the already-ranked list — strictly after ranking, so it never sees scores or weights and cannot change which courses are recommended or their order.

Responsibilities sit behind interfaces (`RecommendationService`, `CourseFilterService`, `RecommendationWeightService`, the scoring and repository interfaces) with `Default*`/`Prisma*` implementations wired together in a single composition root. This lets business rules be tested without a database, lets infrastructure be replaced without touching scoring logic, and keeps the AI layer fully decoupled from ranking.

Deliberate simplifications: static hardcoded weights rather than learned ones, no collaborative filtering, no embeddings, no popularity signal, no feedback loop from past recommendations, no diversity/exploration strategy, and scoring done in application memory rather than in SQL. These were reasonable given the scope — they keep the system explainable, reproducible, and testable, and avoid premature ML complexity on a dataset too small to validate a learned model against.

Some loaded data isn't used yet. `User` fields — role, industry, seniority, company size, stated goal — are fetched but play no role in scoring; profile scoring relies entirely on `UserLearningContext` (primary/secondary topics, likely skill gaps). `Course.level` is stored but not used in filtering or ranking.

## 2. Signal Weighting

**Profile** (`DefaultProfileScoringService`): topic alignment (60%) + skill-gap coverage (40%). Primary-topic match scores 1.0, secondary-topic match scores 0.5. Skill-gap coverage is the proportion of the user's `likely_skill_gaps` the course's `skills_taught` addresses.

**Survey** (`DefaultSurveyScoringService`): preferred-topic match (40%) + survey skill-gap coverage (30%, same ratio logic) + reported confidence (30%). Lower reported confidence in a topic increases relevance for courses in that topic. No survey → score 0, weight redistributed.

**Usage** (`DefaultUsageScoringService`): looks only at the learner's own past events on courses sharing the candidate's topic — a topic-affinity signal, not course-to-course similarity, and never other users' behavior. Completed related-topic course: +1. Dropped: -1. Started at ≥50% progress: +0.5. Starts below 50%: ignored. Total is floored at 0 and capped at 1 (divided by 3).

Weights by `activity_segment`:

| Activity segment | Profile | Survey | Usage |
| ---------------- | ------: | -----: | ----: |
| Starting         |    0.50 |   0.40 |  0.10 |
| Light            |    0.40 |   0.35 |  0.25 |
| Existing         |    0.30 |   0.30 |  0.40 |
| Heavy            |    0.25 |   0.25 |  0.50 |

Newer/less-active learners lean on profile and survey; learners with more history lean on behavioral evidence. When survey or usage data is missing, that weight is zeroed and redistributed proportionally across the remaining signals, then renormalized to sum to 1 — a learner without a survey isn't penalized with a lower ceiling, just scored on what's available.

In production I'd log the algorithm version and served weights, track impression/click/enrollment/completion events per segment, and tune these constants offline before running controlled experiments — not replace the transparent model with a black box until there's evidence it helps.

## 3. Cold-start Strategy

`activity_segment` is a stored field on `UserLearningContext`, not derived at request time from account age or event counts. A `starting` user gets the `starting` row's profile-heavy weights. If they also have no survey and no usage events, both weights redistribute away, leaving profile as the sole signal — recommendations are still possible because every recommendable user is expected to have a `UserLearningContext` row with primary topics, secondary topics, and skill gaps to score against.

Honest limitations: a user without a context row currently throws an error rather than falling back gracefully; the segment isn't dynamically inferred; profile-only recommendations depend entirely on how good that precomputed context is; there's no popularity, cohort, or exploration fallback to diversify early recommendations. A practical next step: derive the segment from actual event count/recency, add a fallback for missing context, and shift weight toward usage as evidence accumulates.

## 4. Measuring Recommendation Quality

**Hypothesis:** personalized weighted recommendations increase course starts and completions versus a non-personalized baseline (top eligible courses by overall popularity).

**Population:** learners shown recommendations, analyzed by activity segment, since weighting differs materially by segment.

**Variants:** control ranks eligible courses by popularity/curated order; treatment uses the current profile/survey/usage weighting. Count, UI, and eligibility filters stay identical so only ranking quality differs.

**Primary metric:** learners who complete a recommended course within 30 days ÷ learners shown recommendations.

**Secondary metrics:** click-through rate, enrollment/start rate, 7-day progression, drop rate, time to first start.

**Guardrails:** endpoint latency, error rate, repeated recommendations across sessions, concentration around too few courses.

**Execution:** assign users consistently and persist the assignment; log each impression with recommendation IDs and algorithm version; join subsequent click/start/completion/drop events back to it; run to a predetermined sample size; compare confidence intervals by segment. Completion is delayed, so I'd watch start rate as an early read while treating completion as the deciding metric.

## 5. Scaling to 10,000+ Users and a Growing Catalog

10,000 stored users alone isn't the risk — recommendations are computed per request from that one user's own data. The real risk is concurrent traffic combined with a growing catalog: `courseRepository.findAll()` fetches the entire catalog every request, filtering happens in application memory, every eligible course gets scored, and the full result set is sorted even though only the top N is returned. `DefaultUsageScoringService` also rebuilds a `courseById` lookup map on every per-course scoring call — an avoidable, roughly quadratic cost as the catalog grows.

**Immediate:** build the lookup map once per request and reuse it across scoring calls; cache the catalog, which changes far less often than it's read; push completed/prerequisite filtering into the repository query; add indexes on user, survey, usage-event, and prerequisite columns; add a deterministic tie-breaker; move to top-K selection instead of a full sort; avoid loading unbounded usage history.

**Medium-term:** cache per-user recommendations, invalidated on survey/usage changes; precompute topic-affinity summaries per user; log impressions/outcomes with algorithm versioning; move weights into versioned configuration instead of source constants; batch-generate recommendations offline for inactive users.

**If the catalog grows very large:** a two-stage design — retrieval narrowing thousands of courses to a relevant subset (indexed topic/skill queries, later possibly embeddings, cohort matching, popularity priors), followed by the existing explainable ranker over that subset, added only once catalog size and evidence justify it.

**AI enrichment at scale:** Gemini stays optional and non-blocking — one batched request per call, a strict timeout, schema-validated responses, null `ai_reason` fallback on any failure. At higher volume I'd add caching for unchanged evidence and rate limiting, but delivery should never depend on Gemini being available.
