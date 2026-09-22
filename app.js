const $ = (selector) => document.querySelector(selector);

const els = {
  score: $("#score"), timer: $("#timer"), timerBar: $(".timer-box i"), timerLabel: $("#timer-label"),
  grid: $("#grid"), start: $("#start-screen"), startButton: $("#start-button"), gameOver: $("#game-over"),
  replay: $("#replay-button"), finalScore: $("#final-score"), resultReason: $("#result-reason"),
  streak: $("#streak-message"), message: $("#message"), bestScore: $("#best-score"), newRecord: $("#new-record")
};

const source = new URLSearchParams(location.search).get("utm_source") || "direct";
const campaign = new URLSearchParams(location.search).get("utm_campaign") || "none";
const content = new URLSearchParams(location.search).get("utm_content") || "none";
const referrer = document.referrer || "none";
const BEST_SCORE_KEY = "three-second-find-best-score";
const telemetry = {
  emit(name, data = {}) {
    const event = { name, data: { source, campaign, content, referrer, ...data }, at: Date.now() };
    window.dispatchEvent(new CustomEvent("threeSecondGame", { detail: event }));
    if (typeof window.gtag === "function") window.gtag("event", name, event.data);
    console.info("[3sec-game]", event);
  }
};

const game = { score: 0, active: false, deadline: 0, frame: 0, timer: 0, bestScore: Number(localStorage.getItem(BEST_SCORE_KEY)) || 0 };
const baseSymbols = ["●", "◆", "▲", "★", "✚", "♥", "☀", "☁"];

function difficulty(score) {
  if (score < 3) return { count: 9, columns: 3, difference: "shape" };
  if (score < 7) return { count: 12, columns: 4, difference: "shape" };
  if (score < 12) return { count: 16, columns: 4, difference: "color" };
  return { count: 20, columns: 4, difference: "subtle-color" };
}

function makeQuestion() {
  const { count, columns, difference } = difficulty(game.score);
  const symbol = baseSymbols[Math.floor(Math.random() * baseSymbols.length)];
  const variant = baseSymbols.filter((item) => item !== symbol)[Math.floor(Math.random() * (baseSymbols.length - 1))];
  const target = Math.floor(Math.random() * count);
  const hue = 38 + Math.floor(Math.random() * 34);
  els.grid.replaceChildren();
  els.grid.style.setProperty("--columns", columns);
  for (let index = 0; index < count; index += 1) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.style.setProperty("--tile-bg", `hsl(${hue + (index % 2 ? 1 : 0)}, 92%, ${scoreLightness()}%)`);
    tile.textContent = difference === "shape" && index === target ? variant : symbol;
    if (difference === "color") tile.style.color = index === target ? "#6742c7" : "#4d2bb9";
    if (difference === "subtle-color") tile.style.color = index === target ? "#5b3bb7" : "#4d2bb9";
    tile.setAttribute("aria-label", index === target ? "違う図形" : "図形");
    tile.addEventListener("click", () => select(tile, index === target));
    els.grid.append(tile);
  }
}

function scoreLightness() { return Math.max(55, 68 - Math.floor(game.score / 5)); }

function select(tile, correct) {
  if (!game.active) return;
  if (!correct) {
    tile.classList.add("wrong");
    endGame("おしい！ ちがうものじゃなかった");
    return;
  }
  tile.classList.add("correct");
  game.active = false;
  cancelAnimationFrame(game.frame);
  game.score += 1;
  els.score.textContent = game.score;
  els.message.textContent = "正解！ 次の問題へ！";
  telemetry.emit("score", { score: game.score });
  window.setTimeout(startRound, 250);
}

function startRound() {
  makeQuestion();
  game.active = true;
  game.deadline = performance.now() + 3000;
  els.message.textContent = "ちがうものをタップ！";
  tick(performance.now());
}

function tick(now) {
  if (!game.active) return;
  const remaining = Math.max(0, game.deadline - now);
  els.timer.textContent = (remaining / 1000).toFixed(2);
  els.timerBar.style.transform = `scaleX(${remaining / 3000})`;
  if (remaining <= 0) { endGame("タイムアップ！"); return; }
  game.frame = requestAnimationFrame(tick);
}

function startGame() {
  game.score = 0;
  els.score.textContent = 0;
  els.start.hidden = true;
  els.gameOver.hidden = true;
  els.grid.hidden = false;
  els.timerLabel.textContent = "のこり";
  els.newRecord.hidden = true;
  telemetry.emit("game_start", { best_score: game.bestScore });
  startRound();
}

function endGame(reason) {
  game.active = false;
  cancelAnimationFrame(game.frame);
  els.grid.hidden = true;
  els.gameOver.hidden = false;
  els.resultReason.textContent = reason;
  els.finalScore.textContent = game.score;
  const isNewRecord = game.score > game.bestScore;
  if (isNewRecord) {
    game.bestScore = game.score;
    localStorage.setItem(BEST_SCORE_KEY, game.bestScore);
    telemetry.emit("best_score", { best_score: game.bestScore });
  }
  els.bestScore.textContent = game.bestScore;
  els.newRecord.hidden = !isNewRecord;
  els.timerLabel.textContent = "終了";
  els.timerBar.style.transform = "scaleX(0)";
  els.streak.textContent = game.score ? `🔥 ${game.score}連続正解！ もう一度記録更新！` : "最初の1問を突破しよう！";
  els.message.textContent = "";
  telemetry.emit("game_over", { score: game.score, best_score: game.bestScore, reason });
}

els.startButton.addEventListener("click", startGame);
els.replay.addEventListener("click", () => { telemetry.emit("retry", { previous_score: game.score }); startGame(); });
els.bestScore.textContent = game.bestScore;
telemetry.emit("referrer");
telemetry.emit("visit");
