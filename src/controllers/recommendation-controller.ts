import type { Request, Response, NextFunction } from "express";

import {
  recommendationAIEnrichmentService,
  recommendationService,
} from "../composition-root.js";

export async function getRecommendationsForUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ error: "userId must be a positive integer." });
      return;
    }

    const nParam = req.query.n;
    const limit = nParam === undefined ? undefined : Number(nParam);

    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      res.status(400).json({ error: "n must be a positive integer." });
      return;
    }

    const recommendations = await recommendationService.recommendForUser(
      userId,
      limit,
    );

    if (req.query.include_ai_review !== "true") {
      res.json({ recommendations });
      return;
    }

    const enrichedRecommendations =
      await recommendationAIEnrichmentService.enrich(recommendations);

    res.json({ recommendations: enrichedRecommendations });
  } catch (error) {
    next(error);
  }
}
