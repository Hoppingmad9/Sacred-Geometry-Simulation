// Dice arithmetic success probability simulator (configurable version)
function simulateDiceTargets({
  trials = 1000,
  xMin = 1,
  xMax = 10,
  numTargetSets = 9,
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

  // Select how many target sets to use
  const targetsList = allTargets.slice(0, numTargetSets);

  // Roll x d6 dice
  function rollDice(x) {
    return Array.from({ length: x }, () => Math.floor(Math.random() * 6) + 1);
  }

  // Recursive solver: can we reach target from numbers?
  function canMakeTarget(numbers, target, memo = new Map()) {
    const key = numbers.slice().sort().join(",") + ":" + target;
    if (memo.has(key)) return memo.get(key);

    // Base case
    if (numbers.length === 1) {
      const result = Math.abs(numbers[0] - target) < 1e-9;
      memo.set(key, result);
      return result;
    }

    // Try all pairs and operations
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
            return true;
          }
        }
      }
    }

    memo.set(key, false);
    return false;
  }

  // Run simulations
  const results = [];

  for (let x = xMin; x <= xMax; x++) {
    for (const targets of targetsList) {
      let successCount = 0;

      for (let t = 0; t < trials; t++) {
        const rolls = rollDice(x);
        for (const target of targets) {
          if (canMakeTarget([...rolls], target)) {
            successCount++;
            break;
          }
        }
      }

      const probability = (successCount / trials) * 100;
      results.push({
        x,
        targets: `[${targets.join(", ")}]`,
        probability,
      });
    }
  }

  // Markdown-style table output
  console.log(`\n### 🎲 Dice Arithmetic Success Probabilities`);
  console.log(`Trials per combination: **${trials}**`);
  console.log(`Dice tested: **${xMin}–${xMax}d6**`);
  console.log(`Target sets used: **${numTargetSets}**\n`);

  const headers = ["x \\ Targets", ...targetsList.map(t => `[${t.join(", ")}]`)];
  const tableRows = [];

  for (let x = xMin; x <= xMax; x++) {
    const row = [`**${x}d6**`];
    for (const targets of targetsList) {
      const entry = results.find(
        r => r.x === x && r.targets === `[${targets.join(", ")}]`
      );
      row.push(entry ? `${entry.probability.toFixed(1)}%` : "—");
    }
    tableRows.push(row);
  }

  // Build Markdown table
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  console.log(headerLine);
  console.log(separatorLine);
  for (const row of tableRows) {
    console.log(`| ${row.join(" | ")} |`);
  }
  console.log("\n✅ Simulation complete.\n");
}

// Example usage:
simulateDiceTargets({
  trials: 1000,     // number of trials per (x, y)
  xMin: 1,          // lowest number of dice
  xMax: 5,          // highest number of dice
  numTargetSets: 3, // number of y groups to test (from the top)
});
