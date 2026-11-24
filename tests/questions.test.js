import test from "node:test";
import { categories, questions } from "../src/questions.js";
import { calculateAura } from "../src/formula.js";

function check(cond, message) {
  if (!cond) throw new Error(message);
}
const styles = ["balanced", "roast", "soft"];
const valuesFor = q => q.type === "boolean"
  ? [true, false, "yes", "probably_yes", "maybe", "unknown", "probably_no", "no"]
  : q.type === "select" ? q.options.map((_, i) => String(i))
  : [q.min, q.default, q.max];
const validateResult = (result, expectedCount) => {
  check(Number.isFinite(result.chance) && result.chance >= 0.1 && result.chance <= 99.9, "Invalid chance");
  check(Number.isFinite(result.raw) && result.cap === 99.9, "Invalid score or unwanted cap");
  check(result.rank && result.verdict, "Missing joke result");
  check(result.categoryScores.reduce((sum, item) => sum + item.count, 0) === expectedCount, "Wrong category count");
  check(result.categoryScores.every(item => Number.isFinite(item.score) && item.score >= 0 && item.score <= 100), "Invalid category score");
};
test("bank is unique, comedy-only and has valid input metadata", () => {
  check(questions.length === 220, "Wrong bank size");
  check(new Set(questions.map(q => q.id)).size === questions.length, "Duplicate ID");
  check(new Set(questions.map(q => q.title)).size === questions.length, "Duplicate question");
  check(categories.length === 12 && categories.every(c => questions.some(q => q.category === c.id)), "Empty category");
  for (const q of questions) {
    check(q.tone === "funny" && q.title.endsWith("?") && q.title.length <= 160, q.id);
    check(categories.some(c => c.id === q.category) && q.weight > 0, q.id);
    check(!/[<>&]/.test(q.title), "Unexpected HTML in " + q.id);
    if (q.type === "range") check(q.lowLabel && q.highLabel && q.default >= q.min && q.default <= q.max, q.id);
    if (q.type === "number") check(q.unit && q.scorer && q.default >= q.min && q.default <= q.max, q.id);
    if (q.type === "select") check(q.options.length >= 3 && new Set(q.options.map(o => o.label)).size === q.options.length && q.options.every(o => Math.abs(o.score) <= q.weight), q.id);
    if (q.type === "boolean") check(q.yesScore !== q.noScore && Math.max(Math.abs(q.yesScore), Math.abs(q.noScore)) === q.weight, q.id);
  }
});
test("every supported answer produces a finite bounded result", () => {
  for (const q of questions) {
    for (const value of valuesFor(q)) {
      for (const resultStyle of styles) {
        validateResult(calculateAura({selectedQuestions: [q], answers: {[q.id]: value}, resultStyle}), 1);
      }
    }
  }
});
test("full bank and category subsets work in all result styles", () => {
  for (const selectedQuestions of [questions, questions.slice(0, 5), questions.slice(0, 40), questions.slice(0, 80), questions.slice(0, 120), ...categories.map(c => questions.filter(q => q.category === c.id))]) {
    for (const resultStyle of styles) {
      for (let mode = 0; mode < 3; mode++) {
        const answers = Object.fromEntries(selectedQuestions.map(q => [q.id, valuesFor(q)[mode % valuesFor(q).length]]));
        validateResult(calculateAura({selectedQuestions, answers, userName: "Test", resultStyle}), selectedQuestions.length);
      }
    }
  }
});
test("a hidden combination requires both explicit answers and selected questions", () => {
  const selectedQuestions = questions.filter(q => ["home_01", "appearance_10"].includes(q.id));
  const both = calculateAura({selectedQuestions, answers: {home_01: "yes", appearance_10: "yes"}});
  check(both.reasons.some(reason => reason.includes("модный дом")), "Missing combo");
  for (const config of [
    {selectedQuestions, answers: {home_01: "yes"}},
    {selectedQuestions: selectedQuestions.slice(0, 1), answers: {home_01: "yes", appearance_10: "yes"}}
  ]) {
    check(!calculateAura(config).reasons.some(reason => reason.includes("модный дом")), "False combo");
  }
});
test("verdict style does not change the numeric result", () => {
  const selectedQuestions = questions.slice(0, 40);
  const answers = Object.fromEntries(selectedQuestions.map(q => [q.id, q.default]));
  const results = styles.map(resultStyle => calculateAura({selectedQuestions, answers, resultStyle}));
  check(new Set(results.map(r => r.chance)).size === 1, "Style changes score");
  check(new Set(results.map(r => r.verdict)).size === styles.length, "Styles have identical verdicts");
});
