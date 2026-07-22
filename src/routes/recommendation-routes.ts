import { Router } from "express";

import { getRecommendationsForUser } from "../controllers/recommendation-controller.js";

export const recommendationRouter = Router();

recommendationRouter.get("/:userId/recommendations", getRecommendationsForUser);
