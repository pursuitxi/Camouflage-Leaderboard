import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  buildLatexTable,
  metricLabel,
  rankBySingleScore,
  rankSum,
  renderBibtex,
  renderCopyNotice,
  renderHero,
  renderMetricLabel,
  renderSelectors,
  renderTableBody,
  renderTableHead,
  sortModelsByMetric,
} from "../assets/leaderboard.js";

const payload = JSON.parse(await fs.readFile(new URL("../data/leaderboards.json", import.meta.url), "utf8"));
const stylesheet = await fs.readFile(new URL("../assets/leaderboard.css", import.meta.url), "utf8");
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

const allDatasets = category.datasets;
const allMetrics = category.metrics;
const tableHead = renderTableHead(allDatasets, allMetrics, category.metricLabels);
const tableBody = renderTableBody(defaultRanked.slice(0, 1), allDatasets, allMetrics);
const selectors = renderSelectors(category, payload.tasks[0].categories);
assert.match(selectors, /class="filter-controls"/);
assert.match(selectors, /class="copy-controls"/);
assert.ok(selectors.indexOf("filter-controls") < selectors.indexOf("copy-controls"));
assert.match(selectors, /id="copy-latex"/);
assert.equal(tableHead.includes("Rank Sum"), false);
assert.equal(tableBody.includes("rank-sum"), false);
assert.equal(metricLabel(category, "MAE"), "$M$");
assert.equal(metricLabel(category, "Smeasure"), "$S_{\\alpha}$");
assert.equal(metricLabel(category, "WeightedFmeasure"), "$F_{\\beta}^{\\omega}$");
assert.equal(metricLabel(category, "Emeasure"), "$E_{\\phi}$");
assert.equal(metricLabel(category, "ContextMeasure"), "$C_{\\beta}^{\\omega}$");
assert.equal(renderMetricLabel("$M$"), "<span class=\"metric-symbol\"><i>M</i></span>");
assert.equal(renderMetricLabel("$S_{\\alpha}$"), "<span class=\"metric-symbol\"><i>S</i><sub>α</sub></span>");
assert.equal(renderMetricLabel("$F_{\\beta}^{\\omega}$"), "<span class=\"metric-symbol\"><i>F</i><sub>β</sub><sup>ω</sup></span>");
assert.equal(renderMetricLabel("$E_{\\phi}$"), "<span class=\"metric-symbol\"><i>E</i><sub>φ</sub></span>");
assert.equal(renderMetricLabel("$C_{\\beta}^{\\omega}$"), "<span class=\"metric-symbol\"><i>C</i><sub>β</sub><sup>ω</sup></span>");
assert.match(tableHead, /<i>C<\/i><sub>β<\/sub><sup>ω<\/sup>/);
assert.equal(tableHead.includes("$C_{\\beta}^{\\omega}$"), false);

const footer = renderBibtex();
assert.match(footer, /Context-measure: Contextualizing Metric for Camouflage/);
assert.match(footer, /Creative Commons Attribution-ShareAlike 4\.0 International License/);
assert.match(footer, /fdp@nankai\.edu\.cn/);
assert.match(footer, /wangchenyang213@gmail\.com/);

const matrixLatex = buildLatexTable(category, allDatasets, allMetrics, defaultRanked.slice(0, 2));
assert.match(matrixLatex, /\\begin\{table\}/);
assert.match(matrixLatex, /\\multicolumn\{5\}\{c\}\{CAMO\}/);
assert.match(matrixLatex, /\$F_\{\\beta\}\^\{\\omega\}\$/);
assert.match(matrixLatex, /\$C_\{\\beta\}\^\{\\omega\}\$/);
assert.match(matrixLatex, /DepthSAM/);
assert.equal(matrixLatex.includes("Rank Sum"), false);
assert.equal(matrixLatex.includes("Rank &"), false);
assert.match(matrixLatex, /Method & Pub\.\/Year & Size & Backbone/);
assert.match(matrixLatex, /DepthSAM & CVPR 26/);

const cod10kContextLatex = buildLatexTable(
  category,
  [category.datasets.find((dataset) => dataset.id === "cod10k")],
  ["ContextMeasure"],
  singleDatasetRanked.slice(0, 2),
);
assert.match(cod10kContextLatex, /COD10K \$C_\{\\beta\}\^\{\\omega\}\$/);
assert.equal(cod10kContextLatex.includes("CAMO"), false);
assert.match(cod10kContextLatex, /DepthSAM & CVPR 26/);

const cod10kMaeSorted = sortModelsByMetric(category.models, "cod10k", "MAE", category.higherIsBetter, "best");
assert.equal(cod10kMaeSorted[0].name, "DepthSAM");
assert.equal(cod10kMaeSorted[0].rank, 1);

const cod10kMaeReverse = sortModelsByMetric(category.models, "cod10k", "MAE", category.higherIsBetter, "worst");
assert.notEqual(cod10kMaeReverse[0].name, "DepthSAM");

const nc4kContextSorted = sortModelsByMetric(category.models, "nc4k", "ContextMeasure", category.higherIsBetter, "best");
assert.equal(nc4kContextSorted[0].name, "DepthSAM");

const copyNotice = renderCopyNotice("LaTeX copied to clipboard");
assert.match(copyNotice, /aria-live="polite"/);
assert.match(copyNotice, /LaTeX copied to clipboard/);

const hero = renderHero(["DepthSAM"], 3);
assert.match(hero, /class="hero-btn hero-btn-leaderboard"/);
assert.match(hero, /class="hero-btn hero-btn-code"/);
assert.match(hero, /class="hero-btn hero-btn-paper"/);
assert.match(stylesheet, /\.hero-btn-leaderboard\s*\{\s*background-color: #24658f;/);
assert.match(stylesheet, /\.hero-btn-code\s*\{\s*background-color: #168577;/);
assert.match(stylesheet, /\.hero-btn-paper\s*\{\s*background-color: #aa4731;/);

console.log("frontend leaderboard ranking tests passed");
