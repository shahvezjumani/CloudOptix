import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import * as searchService from "../services/search.service.js";

const router = Router();
router.use(authenticate);

// GET /api/search?q=invoice&mode=semantic
router.get("/", async (req, res, next) => {
  try {
    const { q, mode = "semantic" } = req.query;

    if (!q || q.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Query must be at least 2 characters" });
    }

    const results =
      mode === "semantic"
        ? await searchService.semanticSearch(q.trim(), req.user.id)
        : await searchService.metadataSearch(q.trim(), req.user.id);

    res.json({
      results,
      query: q,
      mode,
      count: results.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/search/duplicates
router.get("/duplicates", async (req, res, next) => {
  try {
    const duplicates = await searchService.getDuplicates(req.user.id);
    res.json({ duplicates, count: duplicates.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/search/suggestions
router.get("/suggestions", async (req, res, next) => {
  try {
    const suggestions = await searchService.getOptimizationSuggestions(
      req.user.id,
    );
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

export default router;
