// Dice arithmetic simulator with binary compressed cache (gzip)
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function simulateDiceTargets({
  trials = 1000,
  xMin = 1,
  xMax = 10,
  numTargetSets = 9,
  cacheFile = "dice_cache.bin.gz",
} = {}) {
  const allTargets = [
    [3, 5, 7],
    [11, 13, 17],
    [19, 23, 29],
    [31, 37, 41],
    [43, 47, 53],
    [59, 61, 67],
    [71, 73, 79],
    [83, 89, 97],
    [101, 103, 107],
  ];

  const targetsList = allTargets.slice(0, numTargetSets);
  const totalJobs = (xMax - xMin + 1) * targetsList.length;
  let completedJobs = 0;

  // --- Binary compressed cache loading ---
  let globalCache = new Map();

  function loadCache() {
    if (!fs.existsSync(cacheFile)) return;
    try {
      const compressed = fs.readFileSync(cacheFile);
      const jsonStr = zlib.gunzipSync(compressed).toString("utf8");
      const parsed = JSON.parse(jsonStr);
      globalCache = new Map(Object.entries(parsed));
      console.log(`💾 Loaded ${globalCache.size} cached entries from ${cacheFile}`);
    } catch (err) {
      console.warn(`⚠️ Failed to load cache: ${err.message}`);
    }
  }

  function saveCache() {
    try {
      const obj = Object.fromEntries(globalCache);
      const jsonStr = JSON.stringify(obj);
      const compressed = zlib.gzipSync(jsonStr);
      fs.writeFileSync(cacheFile, compressed);
      console.log(`💾 Saved ${globalCache.size} entries (compressed) to ${cacheFile}`);
    } catch (err) {
      console.error(`❌ Failed to save cache: ${err.message}`);
    }
  }

  function saveCacheStream() {
    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(cacheFile);
    const stream = gzip.pipe(out);
    stream.on("finish", () => console.log(`💾 Stream-saved cache to ${cacheFile}`));
    for (const [key, val] of globalCache) {
      gzip.write(JSON.stringify([key, val]) + "\n");
    }
    gzip.end();
  }

  loadCache();

  function rollDice(x) {
    return Array.from({ length: x }, () => Math.floor(Math.random() * 6) + 1);
  }

  function canMakeTarget(numbers, target, memo = new Map()) {
    const sorted = numbers.slice().sort();
    const key = sorted.join(",") + "|" + target;
    if (globalCache.has(key)) return globalCache.get(key);
    if (memo.has(key)) return memo.get(key);

    if (numbers.length === 1) {
      const result = Math.abs(numbers[0] - target) < 1e-9;
      memo.set(key, result);
      globalCache.set(key, result);
      return result;
    }

    for (let i = 0; i < numbers.length; i++) {
      for (let j = 0; j < numbers.length; j++) {
        if (i === j) continue;
        const a = numbers[i];
        const b = numbers[j];
        const rest = numbers.filter((_, idx) => idx !== i && idx !== j);

        const nextValues = [a + b, a - b, b - a, a * b];
        if (b !== 0) nextValues.push(a / b);
        if (a !== 0) nextValues.push(b / a);

        for (const val of nextValues) {
          if (canMakeTarget([...rest, val], target, memo)) {
            memo.set(key, true);
            globalCache.set(key, true);
            return true;
          }
        }
      }
    }

    memo.set(key, false);
    globalCache.set(key, false);
    return false;
  }

  const results = new Map();

  console.log(`\n🚀 Starting simulation with ${trials} trials per combination...`);
  const startTime = Date.now();

  for (const targets of targetsList) {
    for (let x = xMin; x <= xMax; x++) {
      const label = `[${targets.join(", ")}] vs ${x}d6`;
      process.stdout.write(`\rRunning ${label.padEnd(30)} ... `);

      let successCount = 0;

      for (let t = 0; t < trials; t++) {
        const rolls = rollDice(x);
        const rollKey = rolls.slice().sort().join(",");
        let successThisTrial = false;

        for (const target of targets) {
          const key = rollKey + "|" + target;
          if (globalCache.has(key)) {
            if (globalCache.get(key)) {
              successThisTrial = true;
              break;
            }
          } else if (canMakeTarget([...rolls], target)) {
            globalCache.set(key, true);
            successThisTrial = true;
            break;
          } else {
            globalCache.set(key, false);
          }
        }

        if (successThisTrial) successCount++;
      }

      const probability = (successCount / trials) * 100;
      results.set(`${targets.join(",")}|${x}`, probability);

      completedJobs++;
      const percent = ((completedJobs / totalJobs) * 100).toFixed(1);
      process.stdout.write(`Done (${percent}% complete)\n`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Simulation complete in ${duration}s.`);
  console.log(`💾 Cache size now: ${globalCache.size}\n`);

  if (globalCache.size < 1_000_000) {
    saveCache();
  } else {
    console.log(`⚠️ Cache too large (${globalCache.size.toLocaleString()} entries) — stream saving`);
    saveCacheStream();
  }


  // ---- Output Table (Y = Targets, X = Dice) ----
  console.log(`### 🎲 Dice Arithmetic Success Probabilities`);
  console.log(`Trials per combination: **${trials}**`);
  console.log(`Dice tested: **${xMin}–${xMax}d6**`);
  console.log(`Target sets used: **${numTargetSets}**\n`);

  const headers = ["Targets \\ Dice", ...Array.from({ length: xMax - xMin + 1 }, (_, i) => `**${xMin + i}d6**`)];
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  console.log(headerLine);
  console.log(separatorLine);

  for (const targets of targetsList) {
    const row = [`[${targets.join(", ")}]`];
    for (let x = xMin; x <= xMax; x++) {
      const key = `${targets.join(",")}|${x}`;
      const prob = results.get(key);
      row.push(prob !== undefined ? `${prob.toFixed(1)}%` : "—");
    }
    console.log(`| ${row.join(" | ")} |`);
  }

  console.log();
}

// Example usage
simulateDiceTargets({
  trials: 500,
  xMin: 1,
  xMax: 9,
  numTargetSets: 9,
  cacheFile: path.join(__dirname, "dice_cache.bin.gz"),
});
