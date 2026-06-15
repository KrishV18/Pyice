import { templateRouter } from './svg-templates.js';

let allPassed = true;

function runTest(num, schema) {
  try {
    const svg = templateRouter(schema);
    if (typeof svg !== 'string') {
      console.error(`Test ${num} failed: returned non-string`);
      allPassed = false;
      return;
    }
    if (!svg.trim().startsWith('<svg')) {
      console.error(`Test ${num} failed: does not start with <svg (got ${svg.substring(0, 20)}...)`);
      allPassed = false;
      return;
    }
    console.log(`Test ${num} passed (length ${svg.length})`);
  } catch (e) {
    console.error(`Test ${num} threw an exception:`, e);
    allPassed = false;
  }
}

runTest(1, {
  type: "process_flow",
  title: "Photosynthesis",
  steps: ["Light absorption","Water splitting","ATP synthesis","Carbon fixation","Glucose production"],
  highlight: 2
});

runTest(2, {
  type: "formula",
  title: "Newton's Second Law",
  equation: "F = ma",
  variables: [
    { symbol: "F", name: "Force", unit: "N", description: "Net force applied to the object" },
    { symbol: "m", name: "Mass", unit: "kg", description: "Amount of matter in the object" },
    { symbol: "a", name: "Acceleration", unit: "m/s²", description: "Rate of change of velocity" }
  ]
});

runTest(3, {
  type: "compare",
  title: "Mitosis vs Meiosis",
  items: ["Mitosis", "Meiosis"],
  criteria: [
    { label: "Purpose", values: ["Growth/repair", "Reproduction"] },
    { label: "Divisions", values: ["1", "2"] },
    { label: "Daughter cells", values: ["2 identical", "4 unique"] },
    { label: "Ploidy", values: ["Diploid", "Haploid"] }
  ]
});

runTest(4, {
  type: "cycle",
  title: "Water Cycle",
  stages: ["Evaporation", "Condensation", "Precipitation", "Runoff", "Infiltration"]
});

runTest(5, { type: "unknown_type", title: "Test" });

runTest(6, null);

if (allPassed) {
  console.log("All tests passed!");
} else {
  console.log("Some tests failed.");
}
