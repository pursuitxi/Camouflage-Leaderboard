const BASE_PATH = typeof window !== "undefined" && window.location.pathname.includes("/Camouflage-Leaderboard")
  ? "/Camouflage-Leaderboard"
  : "";

const IMAGE_IDS = ["1", "7", "2", "4", "6", "5"];

const state = {
  data: null,
  categoryId: "all",
  datasetId: "all",
  metric: "all",
};

function formatScore(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function getScore(model, datasetId, metric) {
  return model.results?.[datasetId]?.[metric] ?? null;
}

function rankSum(models, datasetIds, metric, higherIsBetter) {
  const totals = new Map(models.map((model) => [model.name, 0]));

  datasetIds.forEach((datasetId) => {
    const scored = models
      .map((model) => ({ name: model.name, score: getScore(model, datasetId, metric) }))
      .filter((item) => typeof item.score === "number");

    scored.sort((a, b) =>
      higherIsBetter[metric] ? b.score - a.score : a.score - b.score,
    );

    scored.forEach((item, index) => {
      totals.set(item.name, totals.get(item.name) + index + 1);
    });
  });

  return models
    .map((model) => ({ ...model, rankSum: totals.get(model.name) }))
    .sort((a, b) => a.rankSum - b.rankSum || a.name.localeCompare(b.name))
    .map((model, index) => ({ ...model, rank: index + 1 }));
}

function rankBySingleScore(models, datasetId, metric, higherIsBetter) {
  return [...models]
    .sort((a, b) => {
      const aScore = getScore(a, datasetId, metric);
      const bScore = getScore(b, datasetId, metric);
      if (typeof aScore !== "number") return 1;
      if (typeof bScore !== "number") return -1;
      return higherIsBetter[metric] ? bScore - aScore : aScore - bScore;
    })
    .map((model, index) => ({ ...model, rank: index + 1 }));
}

function currentTask() {
  return state.data.tasks[0];
}

function currentCategory() {
  return currentTask().categories.find((category) => category.id === state.categoryId);
}

function selectedDatasets(category) {
  if (state.datasetId === "all") return category.datasets;
  return category.datasets.filter((dataset) => dataset.id === state.datasetId);
}

function selectedMetrics(category) {
  if (state.metric === "all") return category.metrics;
  return category.metrics.filter((metric) => metric === state.metric);
}

function rankedModels(category, datasets) {
  const sortMetric = state.metric === "all" ? category.defaultMetric : state.metric;
  const datasetIds = datasets.map((dataset) => dataset.id);

  if (datasetIds.length > 1) {
    return rankSum(category.models, datasetIds, sortMetric, category.higherIsBetter);
  }

  return rankBySingleScore(category.models, datasetIds[0], sortMetric, category.higherIsBetter);
}

function classForRank(rank) {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "";
}

function option(value, label, selectedValue) {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}

function renderSelectors(category) {
  const categoryOptions = currentTask().categories
    .map((item) => option(item.id, item.name, state.categoryId))
    .join("");
  const datasetOptions = [
    option("all", "All Datasets", state.datasetId),
    ...category.datasets.map((dataset) => option(dataset.id, dataset.name, state.datasetId)),
  ].join("");
  const metricOptions = [
    option("all", "All Metrics", state.metric),
    ...category.metrics.map((metric) => option(metric, metric, state.metric)),
  ].join("");

  return `
    <div class="selectors" aria-label="Leaderboard filters">
      <label>Backbone <select id="category-select">${categoryOptions}</select></label>
      <label>Dataset <select id="dataset-select">${datasetOptions}</select></label>
      <label>Metric <select id="metric-select">${metricOptions}</select></label>
    </div>
  `;
}

function renderTableHead(datasets, metrics, showRankSum) {
  const metricHeader = datasets
    .map((dataset) => `<th class="dataset-group" colspan="${metrics.length}">${dataset.name}</th>`)
    .join("");
  const metricSubHeader = datasets
    .flatMap((dataset) =>
      metrics.map((metric) => `<th class="metric" title="${dataset.name} ${metric}">${metric}</th>`),
    )
    .join("");

  return `
    <thead>
      <tr>
        <th class="rank" rowspan="2">Rank</th>
        <th class="model" rowspan="2">Model</th>
        <th class="meta" rowspan="2">Pub./Year</th>
        <th class="meta" rowspan="2">Size</th>
        <th class="meta" rowspan="2">Backbone</th>
        ${showRankSum ? '<th class="rank-sum" rowspan="2">Rank Sum</th>' : ""}
        ${metricHeader}
      </tr>
      <tr>${metricSubHeader}</tr>
    </thead>
  `;
}

function renderTableBody(models, datasets, metrics, showRankSum) {
  return `
    <tbody>
      ${models
        .map((model) => {
          const values = datasets
            .flatMap((dataset) =>
              metrics.map((metric) => {
                const score = getScore(model, dataset.id, metric);
                return `<td class="dataset metric-value">${formatScore(score)}</td>`;
              }),
            )
            .join("");

          return `
            <tr class="${classForRank(model.rank)}">
              <td class="rank">${model.rank}</td>
              <td class="model">${model.name}</td>
              <td class="meta">${model.pubYear ?? "-"}</td>
              <td class="meta">${model.size ?? "-"}</td>
              <td class="meta">${model.backbone ?? "-"}</td>
              ${showRankSum ? `<td class="rank-sum">${model.rankSum}</td>` : ""}
              ${values}
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
}

function renderLeaderboard() {
  const category = currentCategory();
  const datasets = selectedDatasets(category);
  const metrics = selectedMetrics(category);
  const models = rankedModels(category, datasets);
  const showRankSum = datasets.length > 1;

  const tableClass = [
    "leaderboard-table",
    datasets.length === 1 && metrics.length === 1 ? "single-mode" : "",
    metrics.length > 1 ? "matrix-mode" : "",
  ]
    .filter(Boolean)
    .join(" ");

  document.querySelector("#leaderboard").innerHTML = `
    <h2 class="title">Leaderboard</h2>
    ${renderSelectors(category)}
    <div class="table-scroll">
      <table class="${tableClass}">
        ${renderTableHead(datasets, metrics, showRankSum)}
        ${renderTableBody(models, datasets, metrics, showRankSum)}
      </table>
    </div>
  `;

  document.querySelector("#category-select").addEventListener("change", (event) => {
    state.categoryId = event.target.value;
    state.datasetId = "all";
    state.metric = "all";
    renderLeaderboard();
  });
  document.querySelector("#dataset-select").addEventListener("change", (event) => {
    state.datasetId = event.target.value;
    renderLeaderboard();
  });
  document.querySelector("#metric-select").addEventListener("change", (event) => {
    state.metric = event.target.value;
    renderLeaderboard();
  });
}

function renderHero(modelNames, datasetCount) {
  const marqueeItems = [...modelNames, ...modelNames]
    .map((name) => `<div class="model-box"><span class="model-name">${name}</span></div>`)
    .join("");

  return `
    <section class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">Camouflage Understanding <br class="custom-br"> Leaderboard</h1>
        <div class="hero-actions">
          <a class="hero-btn" href="#leaderboard"><i class="fa-solid fa-medal"></i><span>Leaderboard</span></a>
          <a class="hero-btn" href="https://github.com/pursuitxi/Context-measure" target="_blank"><i class="fa-brands fa-github"></i><span>Code</span></a>
          <a class="hero-btn" href="https://arxiv.org/pdf/2512.07076" target="_blank"><i class="fa-regular fa-newspaper"></i><span>Paper</span></a>
        </div>
        <div class="hero-description">
          Dive into our <strong>Camouflage Understanding leaderboard</strong>, which evaluates the performance of various models across different camouflage scenarios.
        </div>
        <div class="marquee-container">
          <div class="marquee-title">
            Evaluate <strong>${modelNames.length}+ models</strong> across <strong>${datasetCount}+ datasets</strong>.
          </div>
          <div class="marquee-content">${marqueeItems}</div>
        </div>
      </div>
    </section>
  `;
}

function renderCarousel() {
  const slides = IMAGE_IDS.map(
    (id, index) => `
      <div class="ImageCarousel_carouselSlide__lvjHp">
        <img src="${BASE_PATH}/data/ImageCarousel/${id}.png" alt="Slide ${index}">
      </div>
    `,
  ).join("");

  return `
    <div class="ImageCarousel_carouselContainer__D0Qhl">
      <div class="ImageCarousel_carouselTrack__rlFHU ImageCarousel_scrollLeft__aQJ_N">
        ${slides}
      </div>
    </div>
  `;
}

function renderBibtex() {
  return `
    <section class="section" id="BibTeX">
      <div>
        <h2 class="title">BibTeX</h2>
        <pre class="bibtex"><code>@article{camouflage_understanding_2025,
  title={Camouflage Understanding Leaderboard},
  author={Camouflage Leaderboard Contributors},
  year={2025}
}</code></pre>
      </div>
    </section>
  `;
}

function renderShell() {
  const task = currentTask();
  const allCategory = task.categories.find((category) => category.id === "all");
  const modelNames = allCategory.models.map((model) => model.name);

  document.querySelector("#app").innerHTML = `
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    ${renderHero(modelNames, allCategory.datasets.length)}
    ${renderCarousel()}
    <section class="benchmark" id="leaderboard"></section>
    ${renderBibtex()}
  `;

  renderLeaderboard();
}

async function boot() {
  try {
    const response = await fetch(`${BASE_PATH}/data/leaderboards.json`);
    if (!response.ok) throw new Error(response.statusText);
    state.data = await response.json();
    renderShell();
  } catch (error) {
    console.error(error);
    document.querySelector("#app").innerHTML = "<div class=\"benchmark\">Failed to load leaderboards.json</div>";
  }
}

if (typeof document !== "undefined") {
  boot();
}

export { formatScore, rankBySingleScore, rankSum };
