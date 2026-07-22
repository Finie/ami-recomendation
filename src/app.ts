import express from "express";
import type { NextFunction, Request, Response } from "express";

import { recommendationRouter } from "./routes/recommendation-routes.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", recommendationRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  const message = err instanceof Error ? err.message : "Internal server error";
  const status = message.toLowerCase().includes("not found") ? 404 : 500;

  res.status(status).json({ error: message });
});
