(function () {
  "use strict";

  const STOPWORDS = new Set(
    "a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves review reviews phone product customer customers device use used using quality good great bad work works working one get got make makes made really much many also still well easy love like dont doesnt wasnt isnt couldnt wont youre theyre thats ive its wasnt wasnt day days battery camera screen apps app life price value quality fast slow time money month months year years product phone option experience excellent amazing recommend recommendable happy pleased satisfied durable premium smooth clear helpful support service issue problem issues disappointing disappointed poor terrible worst average okay ok decent amazing awesome fantastic perfect recommendable enjoyable satisfied satisfied however although despite cause caused causes feels feel felt known say said think thought use using get got make made see seen take took definitely always never every much very quite rather absolutely part per very some lot lots thing things feature features features quality design performance purchase buy bought store online order orders orders"
      .split(/\s+/)
  );
  const COLORS = { positive: "#47d6a0", negative: "#ff777c" };
  const state = { records: [], headers: [], sourceName: "Sample data" };

  function parseCsv(text) {
    const input = String(text).replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < input.length; i += 1) {
      const character = input[i];
      if (quoted) {
        if (character === '"' && input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"' && field.length === 0) {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        row.push(field);
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        field = "";
        if (character === "\r" && input[i + 1] === "\n") i += 1;
      } else {
        field += character;
      }
    }

    if (quoted) throw new Error("The CSV file contains an unclosed quoted field.");
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    if (rows.length < 2) throw new Error("The CSV file must include a header row and at least one review.");

    const headers = rows[0].map((header) => header.trim());
    const required = ["sentiment", "confidence", "review"];
    const missing = required.filter((column) => !headers.includes(column));
    if (missing.length) throw new Error(`Missing required CSV column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);

    const records = rows.slice(1).map((cells, rowIndex) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? "";
      });
      record.sentiment = String(record.sentiment).trim().toUpperCase();
      record.confidence = Number(record.confidence);
      if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
        throw new Error(`Invalid confidence value on CSV row ${rowIndex + 2}. Expected a number from 0 to 1.`);
      }
      if (!["POSITIVE", "NEGATIVE"].includes(record.sentiment)) {
        throw new Error(`Invalid sentiment on CSV row ${rowIndex + 2}. Expected POSITIVE or NEGATIVE.`);
      }
      return record;
    });

    return { headers, records };
  }

  function selectedSentiments() {
    return new Set(
      Array.from(document.querySelectorAll("#sentiment-filters input:checked")).map((input) => input.value)
    );
  }

  function filteredRecords(records, sentiments, minimum, maximum) {
    return records.filter(
      (record) =>
        sentiments.has(record.sentiment) &&
        record.confidence >= minimum &&
        record.confidence <= maximum
    );
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(headers, records) {
    return [headers.map(csvEscape).join(",")]
      .concat(records.map((record) => headers.map((header) => csvEscape(record[header])).join(",")))
      .join("\r\n");
  }

  function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function makeSvgElement(name, attributes) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function renderSentimentChart(records) {
    const svg = document.getElementById("sentiment-chart");
    const positive = records.filter((record) => record.sentiment === "POSITIVE").length;
    const negative = records.filter((record) => record.sentiment === "NEGATIVE").length;
    const total = records.length;
    const radius = 57;
    const circumference = 2 * Math.PI * radius;
    const positiveLength = total ? (positive / total) * circumference : 0;

    svg.replaceChildren();
    svg.append(makeSvgElement("circle", {
      cx: 80, cy: 80, r: radius, fill: "none", stroke: "#2b2d38", "stroke-width": 20
    }));
    if (positive > 0) {
      svg.append(makeSvgElement("circle", {
        cx: 80, cy: 80, r: radius, fill: "none", stroke: COLORS.positive, "stroke-width": 20,
        "stroke-dasharray": `${positiveLength} ${circumference - positiveLength}`
      }));
    }
    if (negative > 0) {
      svg.append(makeSvgElement("circle", {
        cx: 80, cy: 80, r: radius, fill: "none", stroke: COLORS.negative, "stroke-width": 20,
        "stroke-dasharray": `${circumference - positiveLength} ${positiveLength}`,
        "stroke-dashoffset": -positiveLength
      }));
    }
    document.getElementById("chart-total").textContent = total.toLocaleString();
    document.getElementById("chart-positive").textContent = positive.toLocaleString();
    document.getElementById("chart-negative").textContent = negative.toLocaleString();
    document.getElementById("filtered-count").textContent = `${total.toLocaleString()} review${total === 1 ? "" : "s"}`;
  }

  function renderConfidenceChart(records) {
    const svg = document.getElementById("confidence-chart");
    const width = 520;
    const height = 190;
    const left = 34;
    const right = 12;
    const top = 13;
    const bottom = 31;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const bins = Array.from({ length: 20 }, () => 0);

    records.forEach((record) => {
      const index = Math.min(bins.length - 1, Math.floor(record.confidence * bins.length));
      bins[index] += 1;
    });
    const maximum = Math.max(1, ...bins);
    svg.replaceChildren();

    for (let line = 0; line <= 3; line += 1) {
      const y = top + (plotHeight * line) / 3;
      svg.append(makeSvgElement("line", { x1: left, y1: y, x2: width - right, y2: y, stroke: "#2b2d37", "stroke-width": 1 }));
      const label = makeSvgElement("text", { x: left - 8, y: y + 3, fill: "#858998", "font-size": 9, "text-anchor": "end" });
      label.textContent = Math.round(maximum * (1 - line / 3)).toString();
      svg.append(label);
    }
    const gap = 4;
    const barWidth = (plotWidth - gap * (bins.length - 1)) / bins.length;
    bins.forEach((count, index) => {
      const barHeight = (count / maximum) * plotHeight;
      svg.append(makeSvgElement("rect", {
        x: left + index * (barWidth + gap), y: top + plotHeight - barHeight,
        width: barWidth, height: Math.max(0, barHeight), rx: 3,
        fill: "#9688ff", opacity: count ? 0.9 : 0.18
      }));
    });
    [["0%", 0], ["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["100%", 1]].forEach(([text, value]) => {
      const label = makeSvgElement("text", {
        x: left + plotWidth * value, y: height - 8, fill: "#858998",
        "font-size": 9, "text-anchor": value === 0 ? "start" : value === 1 ? "end" : "middle"
      });
      label.textContent = text;
      svg.append(label);
    });
  }

  function renderWordCloud(records, sentiment, targetId) {
    const cloud = document.getElementById(targetId);
    const frequencies = new Map();
    records.filter((record) => record.sentiment === sentiment).forEach((record) => {
      String(record.review).toLowerCase().match(/[a-z][a-z']{2,}/g)?.forEach((word) => {
        if (!STOPWORDS.has(word)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
      });
    });
    const entries = Array.from(frequencies.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    cloud.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("span");
      empty.className = "word-cloud-empty";
      empty.textContent = `No ${sentiment.toLowerCase()} reviews match these filters.`;
      cloud.append(empty);
      return;
    }
    const maximum = entries[0][1];
    entries.forEach(([word, frequency], index) => {
      const token = document.createElement("span");
      token.className = "word-token";
      token.style.fontSize = `${12 + (frequency / maximum) * 13 - Math.min(index, 9) * 0.3}px`;
      token.style.opacity = `${0.68 + (frequency / maximum) * 0.32}`;
      token.textContent = word;
      token.title = `${frequency} mention${frequency === 1 ? "" : "s"}`;
      cloud.append(token);
    });
  }

  function renderReviewTable(records, headers) {
    const body = document.getElementById("review-rows");
    const empty = document.getElementById("empty-reviews");
    body.replaceChildren();
    const columns = [
      { key: "review", className: "" },
      { key: "product", className: "" },
      { key: "sentiment", className: "" },
      { key: "confidence", className: "confidence-cell" },
      { key: "date", className: "" }
    ].filter((column) => headers.includes(column.key));

    records.slice(0, 10).forEach((record) => {
      const row = document.createElement("tr");
      columns.forEach(({ key, className }) => {
        const cell = document.createElement("td");
        cell.className = className;
        if (key === "sentiment") {
          const pill = document.createElement("span");
          const dot = document.createElement("span");
          pill.className = `sentiment-pill ${record.sentiment === "POSITIVE" ? "positive-pill" : "negative-pill"}`;
          dot.className = `sentiment-dot ${record.sentiment === "POSITIVE" ? "positive-dot" : "negative-dot"}`;
          pill.append(dot, document.createTextNode(record.sentiment));
          cell.append(pill);
        } else if (key === "confidence") {
          cell.textContent = formatPercent(record.confidence);
        } else {
          cell.textContent = record[key];
        }
        row.append(cell);
      });
      body.append(row);
    });
    empty.hidden = records.length > 0;
    document.querySelector("thead tr").replaceChildren(
      ...columns.map(({ key }) => {
        const heading = document.createElement("th");
        heading.scope = "col";
        heading.textContent = ({ review: "Review", product: "Product", sentiment: "Sentiment", confidence: "Confidence", date: "Date" })[key];
        return heading;
      })
    );
  }

  function render() {
    const records = state.records;
    const positive = records.filter((record) => record.sentiment === "POSITIVE").length;
    const negative = records.filter((record) => record.sentiment === "NEGATIVE").length;
    const average = records.length ? records.reduce((sum, record) => sum + record.confidence, 0) / records.length : 0;
    const confidenceValues = records.map((record) => record.confidence);
    const minimum = confidenceValues.length ? Math.min(...confidenceValues) : 0;
    const maximum = confidenceValues.length ? Math.max(...confidenceValues) : 1;

    document.getElementById("total-reviews").textContent = records.length.toLocaleString();
    document.getElementById("positive-percent").textContent = formatPercent(records.length ? positive / records.length : 0);
    document.getElementById("negative-percent").textContent = formatPercent(records.length ? negative / records.length : 0);
    document.getElementById("positive-total").textContent = positive.toLocaleString();
    document.getElementById("negative-total").textContent = negative.toLocaleString();
    document.getElementById("average-confidence").textContent = formatPercent(average);
    document.getElementById("positive-filter-count").textContent = positive.toLocaleString();
    document.getElementById("negative-filter-count").textContent = negative.toLocaleString();

    const minSlider = document.getElementById("confidence-min");
    const maxSlider = document.getElementById("confidence-max");
    minSlider.min = maximum === minimum ? String(Math.max(0, minimum - 0.01)) : String(minimum);
    minSlider.max = String(maximum);
    maxSlider.min = String(minimum);
    maxSlider.max = maximum === minimum ? String(Math.min(1, maximum + 0.01)) : String(maximum);
    minSlider.value = String(minimum);
    maxSlider.value = String(maximum);
    updateFilterLabels();
    document.getElementById("data-source").textContent = state.sourceName;
    renderFiltered();
  }

  function updateFilterLabels() {
    const minimum = Number(document.getElementById("confidence-min").value);
    const maximum = Number(document.getElementById("confidence-max").value);
    document.getElementById("confidence-min-label").textContent = formatPercent(minimum);
    document.getElementById("confidence-max-label").textContent = formatPercent(maximum);
  }

  function renderFiltered() {
    const visible = filteredRecords(
      state.records,
      selectedSentiments(),
      Number(document.getElementById("confidence-min").value),
      Number(document.getElementById("confidence-max").value)
    );
    updateFilterLabels();
    renderSentimentChart(visible);
    renderConfidenceChart(visible);
    renderReviewTable(visible, state.headers);
    renderWordCloud(visible, "POSITIVE", "positive-words");
    renderWordCloud(visible, "NEGATIVE", "negative-words");

    const positivePercent = state.records.length
      ? state.records.filter((record) => record.sentiment === "POSITIVE").length / state.records.length
      : 0;
    const insight = positivePercent > 0.7
      ? "Customers are very satisfied overall. Keep building on the parts of the experience they value."
      : positivePercent > 0.5
        ? "Customer sentiment is moderately positive. There are still opportunities to improve."
        : "Customers are largely dissatisfied. Review negative feedback to identify recurring issues.";
    document.getElementById("insight-copy").textContent = state.records.length ? insight : "No review data is available.";
  }

  function showError(message) {
    const error = document.getElementById("error-message");
    error.textContent = message;
    error.hidden = false;
  }

  async function loadSampleData() {
    try {
      const response = await fetch("/analyzed_reviews.csv", { cache: "no-store" });
      if (!response.ok) throw new Error(`Sample data request failed (${response.status}).`);
      const parsed = parseCsv(await response.text());
      state.records = parsed.records;
      state.headers = parsed.headers;
      state.sourceName = `Sample data · ${parsed.records.length.toLocaleString()} reviews`;
      render();
    } catch (error) {
      showError(`Could not load sample reviews: ${error.message}`);
      document.getElementById("data-source").textContent = "Sample data unavailable";
    }
  }

  async function loadUpload(file) {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      state.records = parsed.records;
      state.headers = parsed.headers;
      state.sourceName = `Uploaded · ${file.name}`;
      document.getElementById("error-message").hidden = true;
      render();
    } catch (error) {
      showError(error.message);
    }
  }

  function initialize() {
    document.querySelectorAll("#sentiment-filters input").forEach((input) => {
      input.addEventListener("change", renderFiltered);
    });
    const minimum = document.getElementById("confidence-min");
    const maximum = document.getElementById("confidence-max");
    minimum.addEventListener("input", () => {
      if (Number(minimum.value) > Number(maximum.value)) maximum.value = minimum.value;
      renderFiltered();
    });
    maximum.addEventListener("input", () => {
      if (Number(maximum.value) < Number(minimum.value)) minimum.value = maximum.value;
      renderFiltered();
    });
    document.getElementById("csv-upload").addEventListener("change", (event) => loadUpload(event.target.files[0]));
    document.getElementById("csv-upload-mobile").addEventListener("change", (event) => loadUpload(event.target.files[0]));
    document.getElementById("download-reviews").addEventListener("click", () => {
      const visible = filteredRecords(
        state.records,
        selectedSentiments(),
        Number(minimum.value),
        Number(maximum.value)
      );
      const blob = new Blob([toCsv(state.headers, visible)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "filtered_analyzed_reviews.csv";
      link.click();
      URL.revokeObjectURL(url);
    });
    loadSampleData();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseCsv, filteredRecords, toCsv };
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
    else initialize();
  }
})();
