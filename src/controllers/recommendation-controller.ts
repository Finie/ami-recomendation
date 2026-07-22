import type { Request, Response, NextFunction } from "express";

import { recommendationService } from "../composition-root.js";

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

    const limitParam = req.query.limit;
    const limit = limitParam === undefined ? undefined : Number(limitParam);

    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      res.status(400).json({ error: "limit must be a positive integer." });
      return;
    }

    const recommendations = await recommendationService.recommendForUser(
      userId,
      limit,
    );

    res.json({ recommendations });
  } catch (error) {
    next(error);
  }
}
