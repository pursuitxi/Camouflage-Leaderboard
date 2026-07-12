import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { rankBySingleScore, rankSum } from "../assets/leaderboard.js";

const payload = JSON.parse(await fs.readFile(new URL("../data/leaderboards.json", import.meta.url), "utf8"));
const category = payload.tasks[0].categories.find((item) => item.id === "all");

const datasetIds = category.datasets.map((dataset) => dataset.id);

const defaultRanked = rankSum(
  category.models,
  datasetIds,
  "ContextMeasure",
  category.higherIsBetter,
);
assert.equal(defaultRanked[0].name, "DepthSAM");
assert.equal(defaultRanked[0].rankSum, 3);

const maeRanked = rankSum(category.models, datasetIds, "MAE", category.higherIsBetter);
assert.equal(maeRanked[0].name, "DepthSAM");
assert.equal(maeRanked[0].rankSum, 3);

const singleDatasetRanked = rankBySingleScore(
  category.models,
  "cod10k",
  "ContextMeasure",
  category.higherIsBetter,
);
assert.equal(singleDatasetRanked[0].name, "DepthSAM");

console.log("frontend leaderboard ranking tests passed");
