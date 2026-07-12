const BASE_PATH = typeof window !== "undefined" && window.location.pathname.includes("/Camouflage-Leaderboard")
  ? "/Camouflage-Leaderboard"
  : "";

const IMAGE_IDS = ["1", "7", "2", "4", "6", "5"];

const state = {
  data: null,
  categoryId: "all",
  datasetId: "all",
  metric: "all",
  sort: null,
};

function formatScore(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function latexEscape(value) {
  const text = value == null ? "-" : String(value);
  const replacements = {
    "\\": "\\textbackslash{}",
    "&": "\\&",
    "%": "\\%",
    "$": "\\$",
    "#": "\\#",
    "_": "\\_",
    "{": "\\{",
    "}": "\\}",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return text.replace(/[\\&%$#_{}~^]/g, (char) => replacements[char]);
}

function metricLabel(category, metric) {
  return category.metricLabels?.[metric] ?? metric;
}

function renderMetricLabel(label) {
  const renderedLabels = {
    "$M$": "<span class=\"metric-symbol\"><i>M</i></span>",
    "$S_{\\alpha}$": "<span class=\"metric-symbol\"><i>S</i><sub>α</sub></span>",
    "$F_{\\beta}^{\\omega}$": "<span class=\"metric-symbol\"><i>F</i><sub>β</sub><sup>ω</sup></span>",
    "$E_{\\phi}$": "<span class=\"metric-symbol\"><i>E</i><sub>φ</sub></span>",
    "$C_{\\beta}^{\\omega}$": "<span class=\"metric-symbol\"><i>C</i><sub>β</sub><sup>ω</sup></span>",
  };
  return renderedLabels[label] ?? label;
}

function metricTextLabel(label) {
  return renderMetricLabel(label).replace(/<[^>]+>/g, "");
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

function sortModelsByMetric(models, datasetId, metric, higherIsBetter, direction = "best") {
  const betterFirst = direction === "best";
  const metricHigherIsBetter = higherIsBetter[metric];

  return [...models]
    .sort((a, b) => {
      const aScore = getScore(a, datasetId, metric);
      const bScore = getScore(b, datasetId, metric);
      if (typeof aScore !== "number") return 1;
      if (typeof bScore !== "number") return -1;

      if (metricHigherIsBetter) {
        return betterFirst ? bScore - aScore : aScore - bScore;
      }
      return betterFirst ? aScore - bScore : bScore - aScore;
    })
    .map((model, index) => ({ ...model, rank: index + 1 }));
}

function buildLatexTable(category, datasets, metrics, models) {
  const baseHeaders = ["Method", "Pub./Year", "Size", "Backbone"];
  const dataColumnCount = datasets.length * metrics.length;
  const alignment = `llll${"c".repeat(dataColumnCount)}`;
  const lines = [
    "\\begin{table}[t]",
    "\\centering",
    "\\small",
    `\\begin{tabular}{${alignment}}`,
    "\\hline",
  ];

  if (datasets.length === 1 && metrics.length === 1) {
    const metric = metrics[0];
    lines.push(
      [
        ...baseHeaders,
        `${latexEscape(datasets[0].name)} ${metricLabel(category, metric)}`,
      ].join(" & ") + " \\\\",
    );
  } else {
    const datasetHeaders = datasets.map(
      (dataset) => `\\multicolumn{${metrics.length}}{c}{${latexEscape(dataset.name)}}`,
    );
    const metricHeaders = datasets.flatMap(() =>
      metrics.map((metric) => metricLabel(category, metric)),
    );

    lines.push([...baseHeaders, ...datasetHeaders].join(" & ") + " \\\\");
    lines.push([...baseHeaders.map(() => ""), ...metricHeaders].join(" & ") + " \\\\");
  }

  lines.push("\\hline");

  models.forEach((model) => {
    const scores = datasets.flatMap((dataset) =>
      metrics.map((metric) => formatScore(getScore(model, dataset.id, metric))),
    );
    lines.push(
      [
        latexEscape(model.name),
        latexEscape(model.pubYear),
        latexEscape(model.size),
        latexEscape(model.backbone),
        ...scores,
      ].join(" & ") + " \\\\",
    );
  });

  lines.push("\\hline", "\\end{tabular}", "\\end{table}");
  return lines.join("\n");
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
  const visibleMetricIds = selectedMetrics(category).map((metric) => metric);

  if (
    state.sort &&
    datasetIds.includes(state.sort.datasetId) &&
    visibleMetricIds.includes(state.sort.metric)
  ) {
    return sortModelsByMetric(
      category.models,
      state.sort.datasetId,
      state.sort.metric,
      category.higherIsBetter,
      state.sort.direction,
    );
  }

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

function renderSelectors(category, categories = null) {
  const availableCategories = categories ?? currentTask().categories;
  const categoryOptions = availableCategories
    .map((item) => option(item.id, item.name, state.categoryId))
    .join("");
  const datasetOptions = [
    option("all", "All Datasets", state.datasetId),
    ...category.datasets.map((dataset) => option(dataset.id, dataset.name, state.datasetId)),
  ].join("");
  const metricOptions = [
    option("all", "All Metrics", state.metric),
    ...category.metrics.map((metric) => option(metric, metricTextLabel(metricLabel(category, metric)), state.metric)),
  ].join("");

  return `
    <div class="selectors" aria-label="Leaderboard filters">
      <div class="filter-controls">
        <label>Backbone <select id="category-select">${categoryOptions}</select></label>
        <label>Dataset <select id="dataset-select">${datasetOptions}</select></label>
        <label>Metric <select id="metric-select">${metricOptions}</select></label>
      </div>
      <div class="copy-controls">
        <button class="copy-latex" id="copy-latex" type="button">Copy LaTeX</button>
        ${renderCopyNotice()}
      </div>
    </div>
  `;
}

function renderCopyNotice(message = "") {
  return `<span class="copy-notice" id="copy-notice" aria-live="polite">${message}</span>`;
}

function renderTableHead(datasets, metrics, metricLabels = {}, sort = null) {
  const metricHeader = datasets
    .map((dataset) => `<th class="dataset-group" colspan="${metrics.length}">${dataset.name}</th>`)
    .join("");
  const metricSubHeader = datasets
    .flatMap((dataset) =>
      metrics.map((metric) => {
        const label = metricLabels[metric] ?? metric;
        const isActive = sort?.datasetId === dataset.id && sort?.metric === metric;
        const indicator = isActive ? (sort.direction === "best" ? " ↓" : " ↑") : "";
        return `
          <th class="metric" title="${dataset.name} ${metricTextLabel(label)}">
            <button class="metric-sort" type="button" data-dataset="${dataset.id}" data-metric="${metric}" aria-label="Sort by ${dataset.name} ${metricTextLabel(label)}">
              ${renderMetricLabel(label)}<span class="sort-indicator">${indicator}</span>
            </button>
          </th>
        `;
      }),
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
        ${metricHeader}
      </tr>
      <tr>${metricSubHeader}</tr>
    </thead>
  `;
}

function renderTableBody(models, datasets, metrics) {
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

  const tableClass = [
    "leaderboard-table",
    datasets.length === 1 && metrics.length === 1 ? "single-mode" : "",
    metrics.length > 1 ? "matrix-mode" : "",
  ]
    .filter(Boolean)
    .join(" ");

  document.querySelector("#leaderboard").innerHTML = `
    <h2 class="title">Leaderboard</h2>
    ${renderSelectors(category, currentTask().categories)}
    <div class="table-scroll">
      <table class="${tableClass}">
        ${renderTableHead(datasets, metrics, category.metricLabels, state.sort)}
        ${renderTableBody(models, datasets, metrics)}
      </table>
    </div>
  `;

  document.querySelector("#category-select").addEventListener("change", (event) => {
    state.categoryId = event.target.value;
    state.datasetId = "all";
    state.metric = "all";
    state.sort = null;
    renderLeaderboard();
  });
  document.querySelector("#dataset-select").addEventListener("change", (event) => {
    state.datasetId = event.target.value;
    state.sort = null;
    renderLeaderboard();
  });
  document.querySelector("#metric-select").addEventListener("change", (event) => {
    state.metric = event.target.value;
    state.sort = null;
    renderLeaderboard();
  });
  document.querySelectorAll(".metric-sort").forEach((button) => {
    button.addEventListener("click", () => {
      const datasetId = button.dataset.dataset;
      const metric = button.dataset.metric;
      const isSameColumn = state.sort?.datasetId === datasetId && state.sort?.metric === metric;
      state.sort = {
        datasetId,
        metric,
        direction: isSameColumn && state.sort.direction === "best" ? "worst" : "best",
      };
      renderLeaderboard();
    });
  });
  document.querySelector("#copy-latex").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const originalText = button.textContent;
    const latex = buildLatexTable(category, datasets, metrics, models);

    try {
      await copyText(latex);
      button.textContent = "Copied";
      showCopyNotice("LaTeX copied to clipboard");
    } catch (error) {
      console.error(error);
      button.textContent = "Copy failed";
      showCopyNotice("Copy failed");
    } finally {
      setTimeout(() => {
        button.textContent = originalText;
      }, 1500);
    }
  });
}

function showCopyNotice(message) {
  const notice = document.querySelector("#copy-notice");
  if (!notice) return;
  notice.textContent = message;
  notice.classList.add("is-visible");
  setTimeout(() => {
    notice.classList.remove("is-visible");
    notice.textContent = "";
  }, 1800);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function renderHero(modelNames, datasetCount) {
  const marqueeItems = [...modelNames, ...modelNames]
    .map((name) => `<div class="model-box"><span class="model-name">${name}</span></div>`)
    .join("");

  return `
    <section class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">Camouflaged Object Segmentation <br class="custom-br"> Leaderboard</h1>
        <div class="hero-actions">
          <a class="hero-btn hero-btn-blue" href="#leaderboard"><i class="fa-solid fa-medal"></i><span>Leaderboard</span></a>
          <a class="hero-btn hero-btn-green" href="https://github.com/pursuitxi/Context-measure" target="_blank"><i class="fa-brands fa-github"></i><span>Code</span></a>
          <a class="hero-btn hero-btn-red" href="https://arxiv.org/pdf/2512.07076" target="_blank"><i class="fa-regular fa-newspaper"></i><span>Paper</span></a>
          <a class="hero-btn hero-btn-black" href="#" target="_blank"><i class="fa-solid fa-file-pdf"></i><span>中译版</span></a>
          <a class="hero-btn hero-btn-blue" href="https://drive.google.com/file/d/1hSakyPT566XvFLuukYviWm72G2eryZEd/view?usp=sharing"><i class="fa-solid fa-stairs"></i><span>Benchmark</span></a>
        </div>
        <div class="hero-description">
          Dive into our <strong>Camouflaged Object Segmentation Leaderboard</strong>, which evaluates the performance of various models across different camouflage scenarios.
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
    <section class="section" id="BibTeX"><div><h2 class="title">BibTeX</h2><pre class="bibtex"><code>
@article{wang2025cmeasure,
  title={Context-measure: Contextualizing Metric for Camouflage},
  author={Wang, Chen-Yang and Ji, Gepeng and Shao, Song and Cheng, Ming-Ming and Fan, Deng-Ping},
  journal={arXiv preprint arXiv:2512.07076},
  year={2025}
}
      </code></pre></div></section><footer class="footer"><div><div>This website is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0 International License</a>. </div><p class="mt-1 text-base"> Feel free to contact us: <a href="mailto:EMAIL">fdp@nankai.edu.cn</a> / <a href="mailto:EMAIL">wangchenyang213@gmail.com</a></p></div></footer>
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

export {
  buildLatexTable,
  formatScore,
  latexEscape,
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
};
