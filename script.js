(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const W = 720;
  const H = 520;
  const COLS = 12;
  const ROWS = 9;
  const M = 3;
  const RIVER_HALF = 13;

  function seeded(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function svgEl(name, attrs, parent) {
    const n = document.createElementNS(SVG_NS, name);
    for (const k in attrs) {
      n.setAttribute(k, attrs[k]);
    }
    if (parent) {
      parent.appendChild(n);
    }
    return n;
  }

  function node(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) {
      n.className = cls;
    }
    if (text !== undefined) {
      n.textContent = text;
    }
    return n;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function bindTabs(list, onSelect) {
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    function activate(tab, focus) {
      tabs.forEach(function (t) {
        const on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) {
        tab.focus();
      }
      onSelect(tab);
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        activate(tab, false);
      });
      tab.addEventListener("keydown", function (e) {
        let next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          next = tabs[(i + 1) % tabs.length];
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          next = tabs[(i - 1 + tabs.length) % tabs.length];
        } else if (e.key === "Home") {
          next = tabs[0];
        } else if (e.key === "End") {
          next = tabs[tabs.length - 1];
        }
        if (next) {
          e.preventDefault();
          activate(next, true);
        }
      });
    });
  }

  const navToggle = document.getElementById("nav-toggle");
  const siteNav = document.getElementById("site-nav");
  navToggle.addEventListener("click", function () {
    const open = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  siteNav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  const svg = document.getElementById("parcel-map");
  const rand = seeded(20250);

  const riverPts = [];
  for (let x = -16; x <= W + 16; x += 8) {
    riverPts.push([x, 260 + 95 * Math.sin(x / 115 + 0.6)]);
  }

  function riverDistance(px, py) {
    let best = Infinity;
    for (let i = 0; i < riverPts.length; i++) {
      const dx = px - riverPts[i][0];
      const dy = py - riverPts[i][1];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) {
        best = d;
      }
    }
    return best;
  }

  const verts = [];
  for (let r = 0; r <= ROWS; r++) {
    const row = [];
    for (let c = 0; c <= COLS; c++) {
      let x = (c * W) / COLS;
      let y = (r * H) / ROWS;
      if (c > 0 && c < COLS) {
        x += (rand() - 0.5) * 18;
      }
      if (r > 0 && r < ROWS) {
        y += (rand() - 0.5) * 18;
      }
      row.push([x, y]);
    }
    verts.push(row);
  }

  const residentialZones = [
    [165, 285, 92, 78],
    [485, 215, 88, 66]
  ];
  const commercialZone = [325, 305, 62, 52];
  const forestZone = [590, 90, 145, 85];

  function inEllipse(x, y, z) {
    const a = (x - z[0]) / z[2];
    const b = (y - z[1]) / z[3];
    return a * a + b * b < 1;
  }

  const parcels = [];
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    for (let c = 0; c < COLS; c++) {
      const pts = [verts[r][c], verts[r][c + 1], verts[r + 1][c + 1], verts[r + 1][c]];
      let cx = 0;
      let cy = 0;
      let area = 0;
      for (let i = 0; i < 4; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % 4];
        cx += a[0] / 4;
        cy += a[1] / 4;
        area += a[0] * b[1] - b[0] * a[1];
      }
      area = Math.abs(area) / 2;
      const p = {
        r: r,
        c: c,
        pts: pts,
        cx: cx,
        cy: cy,
        ha: (area * M * M) / 10000,
        d: riverDistance(cx, cy),
        legalRoll: rand(),
        changeRoll: rand(),
        transfers: 1 + Math.floor(rand() * 5),
        year: 2004 + Math.floor(rand() * 21),
        id: "P-" + pad(r + 1) + "-" + pad(c + 1)
      };
      p.meters = Math.max(0, (p.d - RIVER_HALF) * M);
      if (p.d < 20) {
        p.use = "water";
      } else if (inEllipse(cx, cy, forestZone)) {
        p.use = "forest";
      } else if (residentialZones.some(function (z) { return inEllipse(cx, cy, z); })) {
        p.use = "residential";
      } else if (inEllipse(cx, cy, commercialZone)) {
        p.use = "commercial";
      } else {
        p.use = "farm";
      }
      p.nearHomes = Math.min.apply(null, residentialZones.map(function (z) {
        return Math.hypot(cx - z[0], cy - z[1]);
      }));
      if (p.use === "water") {
        p.legal = "none";
        p.change = "none";
      } else {
        p.legal = p.legalRoll < 0.09 ? "litigation" : p.legalRoll < 0.25 ? "encumbrance" : "clear";
        if (p.use === "forest" && p.changeRoll < 0.22) {
          p.change = "deforest";
        } else if ((p.use === "farm" || p.use === "residential") && p.d < 62 && p.changeRoll < 0.32) {
          p.change = "encroach";
        } else if (p.use === "farm" && p.nearHomes < 105 && p.changeRoll > 0.72) {
          p.change = "landchange";
        } else {
          p.change = "stable";
        }
      }
      p.inSandbox = r >= 3 && r <= 5 && c >= 4 && c <= 7;
      p.affected = false;
      parcels.push(p);
      grid[r].push(p);
    }
  }

  const LAND = {
    farm: "#b9c98f",
    residential: "#dccfa6",
    commercial: "#afbbc8",
    forest: "#5f8b57",
    water: "#7db2e0"
  };
  const LAND_NAME = {
    farm: "Farmland",
    residential: "Residential",
    commercial: "Commercial",
    forest: "Forest",
    water: "Water"
  };
  const CALM = "#dde6d3";
  const MARIGOLD = "#f0a81c";
  const BRICK = "#c2452d";

  const state = { layer: "dossier", sel: null, setback: 80 };

  function wet(fn) {
    return function (p) {
      return p.use === "water" ? LAND.water : fn(p);
    };
  }

  const layers = {
    dossier: {
      name: "Bhumi-Dossier",
      built: "Parcel 360° identity",
      blurb: "Every parcel gets one record that ties together its ownership history, boundaries, land use, encumbrances and litigation.",
      items: ["Ownership history", "Boundaries and land use", "Encumbrances and litigation"],
      fill: function (p) { return LAND[p.use]; },
      mark: function () { return null; },
      legend: [
        { color: LAND.farm, label: "Farmland" },
        { color: LAND.residential, label: "Residential" },
        { color: LAND.commercial, label: "Commercial" },
        { color: LAND.forest, label: "Forest" },
        { color: LAND.water, label: "Water" }
      ],
      info: function (p) {
        if (p.use === "water") {
          return ["Waterbody", [["Record", "Not a private parcel"]]];
        }
        return [p.id, [
          ["Land use", LAND_NAME[p.use]],
          ["Area", p.ha.toFixed(1) + " ha"],
          ["Transfers on record", String(p.transfers)],
          ["Last mutation", String(p.year)],
          ["Linked sources", "Land record, cadastral sheet, satellite pass"]
        ]];
      }
    },
    legal: {
      name: "Legal intelligence",
      built: "AI, RAG and a knowledge graph",
      blurb: "Finds precedents, flags conflicting records and summarizes judgments in several languages.",
      items: ["Precedent discovery", "Conflict detection", "Judgment summary and multilingual support"],
      fill: wet(function (p) {
        return p.legal === "litigation" ? BRICK : p.legal === "encumbrance" ? MARIGOLD : CALM;
      }),
      mark: function (p) { return p.legal === "litigation" ? "hatch-paper" : null; },
      legend: [
        { color: CALM, label: "No encumbrance or case" },
        { color: MARIGOLD, label: "Encumbrance" },
        { color: BRICK, hatch: "#f3f6ef", label: "Litigation" }
      ],
      info: function (p) {
        if (p.use === "water") {
          return ["Waterbody", [["Status", "Not a private parcel"]]];
        }
        const text = {
          clear: ["Clear", "No encumbrance or pending case on record."],
          encumbrance: ["Encumbrance", "A registered charge is recorded against this parcel."],
          litigation: ["Litigation", "A case linked to this parcel is pending. Precedents and a summary of the judgment attach to it."]
        }[p.legal];
        return [p.id, [["Status", text[0]], ["Detail", text[1]]]];
      }
    },
    geo: {
      name: "Geospatial intelligence",
      built: "GIS, satellite and computer vision",
      blurb: "Compares each new satellite pass with the recorded boundary to catch encroachment, land-use change and forest loss.",
      items: ["Encroachment detection", "Land-use change", "Deforestation and hazard mapping"],
      fill: wet(function (p) {
        return p.change === "encroach" ? BRICK : p.change === "landchange" ? MARIGOLD : p.change === "deforest" ? "#254a33" : CALM;
      }),
      mark: function (p) { return p.change === "encroach" ? "hatch-paper" : null; },
      legend: [
        { color: CALM, label: "No change" },
        { color: BRICK, hatch: "#f3f6ef", label: "Possible encroachment" },
        { color: MARIGOLD, label: "Land-use change" },
        { color: "#254a33", label: "Tree cover loss" }
      ],
      info: function (p) {
        if (p.use === "water") {
          return ["Waterbody", [["Status", "Not a private parcel"]]];
        }
        const text = {
          stable: ["No change", "The latest satellite pass matches the recorded boundary and land use."],
          encroach: ["Possible encroachment", "Built-up area found near the boundary. An officer reviews it before any action."],
          landchange: ["Land-use change", "Farmland shows new construction since the previous pass."],
          deforest: ["Tree cover loss", "Canopy is thinner than in the previous pass."]
        }[p.change];
        return [p.id, [["Status", text[0]], ["Detail", text[1]]]];
      }
    },
    policy: {
      name: "Policy simulation",
      built: "A digital policy sandbox",
      blurb: "Try a rule on the map first. See feasibility, economic and environmental impact, and social risk before anything is implemented.",
      items: ["Feasibility scoring", "Economic and environmental impact", "Social risk and prediction"],
      fill: wet(function (p) {
        return p.affected ? (p.use === "residential" ? BRICK : MARIGOLD) : CALM;
      }),
      mark: function (p) { return p.affected && p.use === "residential" ? "hatch-paper" : null; },
      legend: [
        { color: CALM, label: "Outside the setback" },
        { color: MARIGOLD, label: "Inside the setback" },
        { color: BRICK, hatch: "#f3f6ef", label: "Homes inside the setback" }
      ],
      info: function (p) {
        if (p.use === "water") {
          return ["Waterbody", [["Record", "Not a private parcel"]]];
        }
        return [p.id, [
          ["Land use", LAND_NAME[p.use]],
          ["Distance from river", Math.round(p.meters / 10) * 10 + " m"],
          ["Inside the setback", p.affected ? "Yes" : "No"]
        ]];
      }
    },
    sandbox: {
      name: "Innovation sandbox",
      built: "Research and startup ecosystem",
      blurb: "A secure space where researchers and startups build on synthetic data, with challenges, hackathons and milestone-based grants.",
      items: ["Challenges and hackathons", "Synthetic data and validation", "Milestone-based grants"],
      fill: wet(function (p) { return p.inSandbox ? "#bcd6ee" : CALM; }),
      mark: function (p) { return p.inSandbox ? "hatch-canal" : null; },
      legend: [
        { color: CALM, label: "Outside the sandbox" },
        { color: "#bcd6ee", hatch: "#2a78c2", label: "Sandbox zone with synthetic data" }
      ],
      info: function (p) {
        if (p.use === "water") {
          return ["Waterbody", [["Record", "Not a private parcel"]]];
        }
        return [p.id, [
          ["In the sandbox zone", p.inSandbox ? "Yes" : "No"],
          ["Data available", p.inSandbox ? "A synthetic twin of this parcel" : "Real records stay in the secure layer"]
        ]];
      }
    }
  };

  function hatchPattern(defs, id, color) {
    const pat = svgEl("pattern", {
      id: id,
      width: 7,
      height: 7,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(45)"
    }, defs);
    svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: color, "stroke-width": 2.4 }, pat);
  }

  const defs = svgEl("defs", {}, svg);
  hatchPattern(defs, "hatch-paper", "#f3f6ef");
  hatchPattern(defs, "hatch-canal", "#2a78c2");

  const parcelLayer = svgEl("g", {}, svg);

  const riverPath = "M" + riverPts.map(function (q) {
    return q[0].toFixed(1) + " " + q[1].toFixed(1);
  }).join(" L");

  const buffer = svgEl("path", {
    d: riverPath,
    fill: "none",
    stroke: "#2a78c2",
    "stroke-opacity": 0.24,
    "stroke-linejoin": "round",
    "pointer-events": "none",
    "stroke-width": RIVER_HALF * 2
  }, svg);
  buffer.style.display = "none";

  svgEl("path", {
    d: riverPath,
    fill: "none",
    stroke: "#5e9ad0",
    "stroke-width": RIVER_HALF * 2,
    "stroke-linejoin": "round",
    "pointer-events": "none"
  }, svg);

  const sbTop = [];
  for (let c = 4; c <= 8; c++) { sbTop.push(verts[3][c]); }
  for (let r = 4; r <= 6; r++) { sbTop.push(verts[r][8]); }
  for (let c = 7; c >= 4; c--) { sbTop.push(verts[6][c]); }
  for (let r = 5; r >= 4; r--) { sbTop.push(verts[r][4]); }
  const sandboxOutline = svgEl("path", {
    d: "M" + sbTop.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L") + " Z",
    fill: "none",
    stroke: "#13231d",
    "stroke-width": 3,
    "stroke-dasharray": "9 6",
    "pointer-events": "none"
  }, svg);
  sandboxOutline.style.display = "none";

  const selection = svgEl("polygon", {
    fill: "none",
    stroke: "#13231d",
    "stroke-width": 3.5,
    "stroke-linejoin": "round",
    "pointer-events": "none"
  }, svg);

  const scale = svgEl("g", { transform: "translate(14 " + (H - 46) + ")", "pointer-events": "none" }, svg);
  svgEl("rect", { x: -6, y: -8, width: 128, height: 40, fill: "#f3f6ef", "fill-opacity": 0.9 }, scale);
  svgEl("rect", { x: 0, y: 6, width: 100, height: 6, fill: "#13231d" }, scale);
  svgEl("rect", { x: 0, y: 6, width: 50, height: 6, fill: "#f3f6ef", stroke: "#13231d", "stroke-width": 1 }, scale);
  const t0 = svgEl("text", { x: 0, y: 26, "font-size": 12, "font-family": "Instrument Sans, sans-serif", fill: "#13231d" }, scale);
  t0.textContent = "0";
  const t1 = svgEl("text", { x: 100, y: 26, "font-size": 12, "text-anchor": "middle", "font-family": "Instrument Sans, sans-serif", fill: "#13231d" }, scale);
  t1.textContent = "300 m";

  const north = svgEl("g", { transform: "translate(" + (W - 34) + " 36)", "pointer-events": "none" }, svg);
  svgEl("circle", { r: 22, fill: "#f3f6ef", "fill-opacity": 0.9 }, north);
  svgEl("path", { d: "M0 -16 L7 8 L0 3 L-7 8 Z", fill: "#13231d" }, north);
  const tn = svgEl("text", { y: 20, "font-size": 11, "font-weight": 600, "text-anchor": "middle", "font-family": "Instrument Sans, sans-serif", fill: "#13231d" }, north);
  tn.textContent = "N";

  parcels.forEach(function (p) {
    const g = svgEl("g", { class: "parcel-cell" }, parcelLayer);
    const points = p.pts.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ");
    p.base = svgEl("polygon", { class: "base", points: points }, g);
    p.mark = svgEl("polygon", { class: "mark", points: points, fill: "none" }, g);
    g.style.animationDelay = (p.c * 0.045 + p.r * 0.03).toFixed(2) + "s";
    g.addEventListener("click", function () {
      select(p);
    });
    p.points = points;
  });

  const legendEl = document.getElementById("legend");
  const engineEl = document.getElementById("engine-info");
  const parcelEl = document.getElementById("parcel-info");
  const policyControl = document.getElementById("policy-control");
  const setbackInput = document.getElementById("setback");
  const setbackOut = document.getElementById("setback-out");
  const metersEl = document.getElementById("policy-meters");
  const verdictEl = document.getElementById("policy-verdict");
  const mapPanel = document.getElementById("map-panel");

  const meterRows = {};
  [
    ["feas", "Feasibility", false],
    ["econ", "Economic exposure", true],
    ["social", "Social risk", true]
  ].forEach(function (m) {
    const row = node("div", "meter");
    row.appendChild(node("span", "", m[1]));
    const track = node("div", "meter-track");
    const fill = node("div", "meter-fill" + (m[2] ? " is-risk" : ""));
    track.appendChild(fill);
    row.appendChild(track);
    const val = node("span", "meter-value", "0");
    row.appendChild(val);
    metersEl.appendChild(row);
    meterRows[m[0]] = { fill: fill, val: val };
  });

  function setMeter(key, value) {
    meterRows[key].fill.style.width = value + "%";
    meterRows[key].val.textContent = String(value);
  }

  function computePolicy() {
    let n = 0;
    let ha = 0;
    let homes = 0;
    let farm = 0;
    let shops = 0;
    let trees = 0;
    parcels.forEach(function (p) {
      p.affected = p.use !== "water" && p.meters <= state.setback;
      if (p.affected) {
        n += 1;
        ha += p.ha;
        if (p.use === "residential") { homes += 1; }
        if (p.use === "farm") { farm += 1; }
        if (p.use === "commercial") { shops += 1; }
        if (p.use === "forest") { trees += 1; }
      }
    });
    const feas = clamp(Math.round(100 - homes * 7 - shops * 8 - farm * 1.4 - trees), 5, 100);
    const econ = clamp(Math.round(farm * 4 + shops * 12 + homes * 3), 0, 100);
    const social = clamp(homes * 11, 0, 100);
    setMeter("feas", feas);
    setMeter("econ", econ);
    setMeter("social", social);
    buffer.setAttribute("stroke-width", RIVER_HALF * 2 + (2 * state.setback) / M);
    setbackOut.textContent = state.setback + " m";
    if (n === 0) {
      verdictEl.textContent = "No parcels are affected. Widen the setback to test a rule.";
    } else {
      const level = feas >= 70 ? "Low disruption." : feas >= 40 ? "Needs review before rollout." : "High disruption.";
      verdictEl.textContent = n + " parcels (" + Math.round(ha) + " ha) fall inside the setback, " + homes + " of them residential. " + level;
    }
  }

  function paint() {
    const L = layers[state.layer];
    parcels.forEach(function (p) {
      p.base.setAttribute("fill", L.fill(p));
      const m = L.mark(p);
      p.mark.setAttribute("fill", m ? "url(#" + m + ")" : "none");
    });
  }

  function renderLegend(L) {
    legendEl.textContent = "";
    L.legend.forEach(function (item) {
      const li = node("li");
      const sw = node("span", "swatch");
      sw.style.background = item.hatch
        ? "repeating-linear-gradient(45deg, " + item.color + " 0 3px, " + item.hatch + " 3px 5px)"
        : item.color;
      li.appendChild(sw);
      li.appendChild(node("span", "", item.label));
      legendEl.appendChild(li);
    });
  }

  function renderEngine(L) {
    engineEl.textContent = "";
    engineEl.appendChild(node("h3", "", L.name));
    engineEl.appendChild(node("p", "built-on", L.built));
    engineEl.appendChild(node("p", "blurb", L.blurb));
    const ul = node("ul");
    L.items.forEach(function (t) {
      ul.appendChild(node("li", "", t));
    });
    engineEl.appendChild(ul);
  }

  function renderParcel() {
    const L = layers[state.layer];
    const data = L.info(state.sel);
    parcelEl.textContent = "";
    parcelEl.appendChild(node("h3", "", data[0]));
    const dl = node("dl");
    data[1].forEach(function (row) {
      const wrap = node("div");
      wrap.appendChild(node("dt", "", row[0]));
      wrap.appendChild(node("dd", "", row[1]));
      dl.appendChild(wrap);
    });
    parcelEl.appendChild(dl);
  }

  function select(p) {
    state.sel = p;
    selection.setAttribute("points", p.points);
    renderParcel();
  }

  function setLayer(key) {
    state.layer = key;
    const L = layers[key];
    if (key === "policy") {
      computePolicy();
    }
    paint();
    renderLegend(L);
    renderEngine(L);
    policyControl.hidden = key !== "policy";
    buffer.style.display = key === "policy" ? "" : "none";
    sandboxOutline.style.display = key === "sandbox" ? "" : "none";
    renderParcel();
  }

  setbackInput.addEventListener("input", function () {
    state.setback = Number(setbackInput.value);
    computePolicy();
    paint();
    renderParcel();
  });

  svg.addEventListener("keydown", function (e) {
    const moves = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0]
    };
    const mv = moves[e.key];
    if (!mv) {
      return;
    }
    e.preventDefault();
    const r = clamp(state.sel.r + mv[0], 0, ROWS - 1);
    const c = clamp(state.sel.c + mv[1], 0, COLS - 1);
    select(grid[r][c]);
  });

  bindTabs(document.getElementById("layer-tabs"), function (tab) {
    mapPanel.setAttribute("aria-labelledby", tab.id);
    setLayer(tab.dataset.layer);
  });

  const start = parcels
    .filter(function (p) { return p.use === "residential"; })
    .sort(function (a, b) {
      return Math.hypot(a.cx - 165, a.cy - 290) - Math.hypot(b.cx - 165, b.cy - 290);
    })[0];

  select(start);
  setLayer("dossier");

  const WHO = {
    gov: {
      line: "Faster policy analysis and simulation.",
      uses: ["Policy simulation"]
    },
    auth: {
      line: "Parcel verification and dispute alerts.",
      uses: ["Bhumi-Dossier", "Legal intelligence", "Geospatial intelligence"]
    },
    res: {
      line: "Unified data, GIS and legal intelligence.",
      uses: ["Bhumi-Dossier", "Legal intelligence", "Geospatial intelligence"]
    },
    cit: {
      line: "Transparent land and land-use information.",
      uses: ["Bhumi-Dossier"]
    },
    start: {
      line: "APIs and secure innovation sandboxes.",
      uses: ["Innovation sandbox"]
    }
  };

  const whoLine = document.getElementById("who-line");
  const whoUses = document.getElementById("who-uses");
  const whoPanel = document.getElementById("who-panel");

  function showWho(key, tabId) {
    const w = WHO[key];
    whoLine.textContent = w.line;
    whoUses.textContent = "";
    w.uses.forEach(function (u) {
      whoUses.appendChild(node("li", "", u));
    });
    whoPanel.setAttribute("aria-labelledby", tabId);
  }

  bindTabs(document.getElementById("who-tabs"), function (tab) {
    showWho(tab.dataset.who, tab.id);
  });
  showWho("gov", "who-gov");
})();
