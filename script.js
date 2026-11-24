// ============================================================
//  SETTINGS
// ============================================================
const DECIMALS = 10; // your C code printed 2 decimals; change to 2 for the same look

// ============================================================
//  UI HELPERS
// ============================================================
const resultEl = document.getElementById("result");
const expressionEl = document.getElementById("expression");
const angleBtn = document.getElementById("angle-mode");

function setResult(text) {
  resultEl.textContent = text;
  resultEl.classList.remove("error");
}

function setExpression(text) {
  expressionEl.textContent = text;
}

function showError(message = "Error") {
  resultEl.textContent = message;
  resultEl.classList.add("error");
  setExpression("");
  currentInput = "0";
  firstNumber = null;
  pendingOp = null;
  waitingSecond = false;
  justCalculated = true;
}

// Round and remove extra zeros (0.1 + 0.2 -> 0.3)
function format(n) {
  if (Number.isNaN(n)) throw new Error("Invalid input");
  if (!Number.isFinite(n)) throw new Error("Too large");
  return String(parseFloat(n.toFixed(DECIMALS)));
}

// ============================================================
//  CALCULATOR STATE
// ============================================================
let currentInput = "0";     // the number being typed (can be "-", "-5", "3.2")
let firstNumber = null;     // first number of a two-number operation
let pendingOp = null;       // "add", "power", "percent", ...
let waitingSecond = false;  // true right after an operator is pressed
let justCalculated = false; // true right after = or a function
let angleMode = "DEG";      // C program worked in degrees, so DEG is the default

const SYMBOLS = {
  add: "+", subtract: "−", multiply: "×", divide: "÷",
  power: "^", nthroot: "ⁿ√", percent: "% of",
};

const FUNCTION_LABELS = {
  square: "sqr", cube: "cube", sqrt: "√", cbrt: "∛",
  sin: "sin", cos: "cos", tan: "tan",
  asin: "sin⁻¹", acos: "cos⁻¹", atan: "tan⁻¹",
  log: "log", ln: "ln", factorial: "fact", deg2rad: "rad",
};

// the number currently typed ("-" alone counts as 0)
function currentNumber() {
  const v = parseFloat(currentInput);
  return Number.isNaN(v) ? 0 : v;
}

// ============================================================
//  MATH: two-number operations (cases 1-4, 8, 12, 21 of your C code)
// ============================================================
function compute(op, a, b) {
  switch (op) {
    case "add":      return a + b;
    case "subtract": return a - b;
    case "multiply": return a * b;

    case "divide":
      if (b === 0) throw new Error("Division by zero is not valid");
      return a / b;

    case "power":
      if (a === 0 && b < 0) throw new Error("Zero cannot have a negative exponent");
      return Math.pow(a, b);

    case "nthroot":
      // a = the number, b = the root (64 ⁿ√x 3 = 4)
      if (b <= 0 || !Number.isInteger(b)) throw new Error("Root must be a positive integer");
      if (a < 0 && b % 2 === 0) throw new Error("Even root of a negative number is not real");
      if (a < 0) return -Math.pow(-a, 1 / b);
      return Math.pow(a, 1 / b);

    case "percent":
      // a = the value, b = the total  ->  (a / b) * 100
      if (b === 0) throw new Error("Total cannot be zero");
      return (a / b) * 100;

    default:
      throw new Error("Error");
  }
}

// ============================================================
//  MATH: one-number functions (cases 5-7, 9-11, 13-20 of your C code)
// ============================================================
function applyFunction(name, x) {
  const toRad = (v) => (angleMode === "DEG" ? (v * Math.PI) / 180 : v);
  const fromRad = (v) => (angleMode === "DEG" ? (v * 180) / Math.PI : v);

  switch (name) {
    case "square": return x * x;
    case "cube":   return x * x * x;

    case "sqrt":
      if (x < 0) throw new Error("Square root of a negative number is not real");
      return Math.sqrt(x);

    case "cbrt":
      return Math.cbrt(x); // works for negatives too: ∛-8 = -2

    case "sin": return Math.sin(toRad(x));
    case "cos": return Math.cos(toRad(x));

    case "tan":
      if (Math.abs(Math.cos(toRad(x))) < 1e-12) throw new Error("Tangent is undefined");
      return Math.tan(toRad(x));

    case "asin":
      if (x < -1 || x > 1) throw new Error("Value must be from -1 to 1");
      return fromRad(Math.asin(x));

    case "acos":
      if (x < -1 || x > 1) throw new Error("Value must be from -1 to 1");
      return fromRad(Math.acos(x));

    case "atan":
      return fromRad(Math.atan(x));

    case "log":
      if (x <= 0) throw new Error("Log needs a positive number");
      return Math.log10(x);

    case "ln":
      if (x <= 0) throw new Error("ln needs a positive number");
      return Math.log(x);

    case "factorial": {
      if (x < 0 || !Number.isInteger(x)) throw new Error("Whole numbers 0 or more only");
      if (x > 170) throw new Error("Number is too large");
      let r = 1;
      for (let i = 1; i <= x; i++) r *= i;
      return r;
    }

    case "deg2rad":
      return (x * Math.PI) / 180;

    default:
      throw new Error("Error");
  }
}

// ============================================================
//  BUTTON HANDLERS
// ============================================================
function handleNumber(value) {
  // start fresh after = or a function result
  if (justCalculated) {
    currentInput = "0";
    justCalculated = false;
    if (pendingOp === null) setExpression("");
  }
  waitingSecond = false;

  // user pressed "-" first: the number is negative
  if (currentInput === "-") currentInput = "-0";

  // only one decimal point
  if (value === "." && currentInput.includes(".")) return;

  if ((currentInput === "0" || currentInput === "-0") && value !== ".") {
    currentInput = (currentInput === "-0" ? "-" : "") + value;
  } else {
    currentInput += value;
  }
  setResult(currentInput);
}

function handleOperator(op) {
  try {
    // "-" is still waiting for its digits: ignore extra operators
    if (currentInput === "-") return;

    // "-" pressed where a number should start = a NEGATIVE number, not an operator
    //   * at the very start:   -6 + 6
    //   * right after an op:   5 × -3
    const startsNegative =
      op === "subtract" &&
      ((pendingOp === null && currentInput === "0") ||
        (waitingSecond && pendingOp !== "subtract"));

    if (startsNegative) {
      currentInput = "-";
      waitingSecond = false;
      justCalculated = false;
      if (pendingOp === null) setExpression("");
      setResult("-");
      return;
    }

    // operator pressed twice in a row: just change it
    if (pendingOp !== null && waitingSecond) {
      pendingOp = op;
      setExpression(firstNumber + " " + SYMBOLS[op]);
      return;
    }

    // chaining: 2 + 3 + ... calculates 2 + 3 first
    if (pendingOp !== null) {
      const chained = format(compute(pendingOp, firstNumber, currentNumber()));
      firstNumber = parseFloat(chained);
    } else {
      firstNumber = currentNumber();
    }

    pendingOp = op;
    waitingSecond = true;
    justCalculated = false;
    setExpression(firstNumber + " " + SYMBOLS[op]);
    setResult(String(firstNumber));
    currentInput = "0";
  } catch (err) {
    showError(err.message);
  }
}

function handleFunction(name) {
  try {
    const x = currentNumber();
    const answer = format(applyFunction(name, x));
    setExpression(FUNCTION_LABELS[name] + "(" + x + ")");
    setResult(answer);
    currentInput = answer;
    justCalculated = true;
    waitingSecond = false;
  } catch (err) {
    showError(err.message);
  }
}

function handleEquals() {
  if (pendingOp === null) return;
  try {
    const a = firstNumber;
    const b = currentNumber();
    const answer = format(compute(pendingOp, a, b));

    setExpression(a + " " + SYMBOLS[pendingOp] + " " + b + " =");
    setResult(answer);

    currentInput = answer;
    firstNumber = null;
    pendingOp = null;
    waitingSecond = false;
    justCalculated = true;
  } catch (err) {
    showError(err.message);
  }
}

// +/- key: flips the sign of the number on the screen
function handleNegate() {
  // right after an operator, +/- starts a negative second number
  if (waitingSecond || currentInput === "0") {
    currentInput = "-";
    waitingSecond = false;
    justCalculated = false;
    setResult("-");
    return;
  }
  if (currentInput === "-") {
    currentInput = "0";
    setResult("0");
    return;
  }
  currentInput = currentInput.startsWith("-") ? currentInput.slice(1) : "-" + currentInput;
  setResult(currentInput);
}

function handleClear() {
  currentInput = "0";
  firstNumber = null;
  pendingOp = null;
  waitingSecond = false;
  justCalculated = false;
  setResult("0");
  setExpression("");
}

function handleDelete() {
  if (justCalculated) return; // don't edit a finished answer
  currentInput = currentInput.slice(0, -1);
  if (currentInput === "" || currentInput === "-") currentInput = "0";
  setResult(currentInput);
}

function handleAngleToggle() {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  angleBtn.textContent = angleMode;
}

// ============================================================
//  BUTTON WIRING
// ============================================================
const TWO_NUMBER_OPS = ["add", "subtract", "multiply", "divide", "power", "nthroot", "percent"];

document.querySelectorAll(".key").forEach((btn) => {
  btn.addEventListener("click", () => {
    const num = btn.dataset.num;
    const action = btn.dataset.action;

    if (num !== undefined) return handleNumber(num);

    if (action === "clear") return handleClear();
    if (action === "delete") return handleDelete();
    if (action === "equals") return handleEquals();
    if (action === "negate") return handleNegate();
    if (action === "toggle-angle") return handleAngleToggle();
    if (TWO_NUMBER_OPS.includes(action)) return handleOperator(action);

    handleFunction(action);
  });
});

// Keyboard support
const KEY_MAP = {
  "+": "add", "-": "subtract", "*": "multiply", "/": "divide", "%": "percent",
  "Enter": "equals", "=": "equals", "Backspace": "delete", "Escape": "clear",
};

document.addEventListener("keydown", (e) => {
  let btn = null;
  if (/^[0-9.]$/.test(e.key)) {
    btn = document.querySelector(`[data-num="${e.key}"]`);
  } else if (KEY_MAP[e.key]) {
    btn = document.querySelector(`[data-action="${KEY_MAP[e.key]}"]`);
  }
  if (!btn) return;
  e.preventDefault();
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 120);
  btn.click();
});
