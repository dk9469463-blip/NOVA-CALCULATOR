
const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const scientificPanel = document.getElementById("scientificPanel");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");

let expression = "";
let angleMode = "DEG";
let historyItems = [];
let memoryValue = 0;
let justCalculated = false;

const $ = id => document.getElementById(id);

function updateDisplay(preview = true) {
  expressionDisplay.textContent = expression
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/sqrt/g, "√")
    .replace(/pi/g, "π");

  if (!expression) {
    resultDisplay.textContent = "0";
    return;
  }

  if (preview) {
    try {
      const value = calculate(expression);
      resultDisplay.textContent = formatNumber(value);
    } catch {
      resultDisplay.textContent = " ";
    }
  }
}

function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error("Invalid result");

  if (Math.abs(value) < 1e-12 && value !== 0) {
    return value.toExponential(7);
  }

  return Number(value.toPrecision(12)).toLocaleString("en-US", {
    maximumFractionDigits: 10,
    useGrouping: false
  });
}

/* MATHEMATICAL ENGINE */

function tokenize(input) {
  const tokens = [];
  const regex = /\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?|[a-zA-Z]+|[()+\-*/^%!])/gy;
  let position = 0;

  while (position < input.length) {
    regex.lastIndex = position;
    const match = regex.exec(input);

    if (!match) {
      if (/\s/.test(input[position])) {
        position++;
        continue;
      }
      throw new Error("Invalid character");
    }

    const value = match[1];
    position = regex.lastIndex;

    if (/^[0-9]/.test(value)) {
      tokens.push({ type: "number", value: Number(value) });
    } else if (/^[a-zA-Z]+$/.test(value)) {
      const name = value.toLowerCase();

      if (["pi", "e"].includes(name)) {
        tokens.push({ type: "constant", value: name });
      } else if (
        ["sin", "cos", "tan", "asin", "acos", "atan",
         "sqrt", "cbrt", "log", "ln", "exp", "abs",
         "floor", "ceil"].includes(name)
      ) {
        tokens.push({ type: "function", value: name });
      } else {
        throw new Error("Unknown function");
      }
    } else {
      tokens.push({ type: "symbol", value });
    }
  }

  const expanded = [];

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const previous = expanded[expanded.length - 1];

    if (previous) {
      const canEnd =
        previous.type === "number" ||
        previous.type === "constant" ||
        (previous.type === "symbol" &&
          [")", "!", "%"].includes(previous.value));

      const canStart =
        current.type === "number" ||
        current.type === "constant" ||
        current.type === "function" ||
        (current.type === "symbol" && current.value === "(");

      if (canEnd && canStart) {
        expanded.push({ type: "symbol", value: "*" });
      }
    }

    expanded.push(current);
  }

  return expanded;
}

function calculate(input) {
  const tokens = tokenize(input);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function accept(value) {
    if (peek() && peek().value === value) {
      index++;
      return true;
    }
    return false;
  }

  function expression() {
    let value = term();

    while (peek() && ["+", "-"].includes(peek().value)) {
      const operator = tokens[index++].value;
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  function term() {
    let value = unary();

    while (peek() && ["*", "/"].includes(peek().value)) {
      const operator = tokens[index++].value;
      const right = unary();

      if (operator === "/" && right === 0) {
        throw new Error("Cannot divide by zero");
      }

      value = operator === "*" ? value * right : value / right;
    }

    return value;
  }

  function unary() {
    if (accept("+")) return unary();
    if (accept("-")) return -unary();
    return power();
  }

  function power() {
    let value = postfix();

    if (accept("^")) {
      value = Math.pow(value, unary());
    }

    return value;
  }

  function postfix() {
    let value = primary();

    while (peek() && ["!", "%"].includes(peek().value)) {
      const operator = tokens[index++].value;

      if (operator === "%") {
        value /= 100;
      } else {
        if (value < 0 || !Number.isInteger(value) || value > 170) {
          throw new Error("Invalid factorial");
        }

        let factorial = 1;
        for (let i = 2; i <= value; i++) {
          factorial *= i;
        }
        value = factorial;
      }
    }

    return value;
  }

  function primary() {
    const token = tokens[index++];

    if (!token) throw new Error("Incomplete expression");

    if (token.type === "number") {
      return token.value;
    }

    if (token.type === "constant") {
      return token.value === "pi" ? Math.PI : Math.E;
    }

    if (token.type === "function") {
      if (!accept("(")) throw new Error("Function needs parentheses");

      const inputValue = expression();

      if (!accept(")")) throw new Error("Missing closing bracket");

      return applyFunction(token.value, inputValue);
    }

    if (token.value === "(") {
      const value = expression();
      if (!accept(")")) throw new Error("Missing closing bracket");
      return value;
    }

    throw new Error("Invalid expression");
  }

  const answer = expression();

  if (index !== tokens.length) {
    throw new Error("Incomplete expression");
  }

  if (!Number.isFinite(answer)) {
    throw new Error("Math error");
  }

  return answer;
}

function applyFunction(name, value) {
  const angle = angleMode === "DEG" ? Math.PI / 180 : 1;

  switch (name) {
    case "sin": return Math.sin(value * angle);
    case "cos": return Math.cos(value * angle);
    case "tan":
      if (Math.abs(Math.cos(value * angle)) < 1e-12) {
        throw new Error("Undefined");
      }
      return Math.tan(value * angle);

    case "asin":
      return Math.asin(value) / angle;
    case "acos":
      return Math.acos(value) / angle;
    case "atan":
      return Math.atan(value) / angle;

    case "sqrt":
      if (value < 0) throw new Error("Invalid square root");
      return Math.sqrt(value);

    case "cbrt": return Math.cbrt(value);

    case "log":
      if (value <= 0) throw new Error("Invalid logarithm");
      return Math.log10(value);

    case "ln":
      if (value <= 0) throw new Error("Invalid logarithm");
      return Math.log(value);

    case "exp": return Math.exp(value);
    case "abs": return Math.abs(value);
    case "floor": return Math.floor(value);
    case "ceil": return Math.ceil(value);

    default: throw new Error("Unknown function");
  }
}

/* BUTTON INPUT */

function insertValue(value) {
  if (justCalculated && /[0-9.]|pi|e|sqrt\(|sin\(|cos\(|tan\(/.test(value)) {
    expression = "";
  }

  justCalculated = false;

  if (expression.length >= 100) return;

  expression += value;
  updateDisplay();
}

function clearAll() {
  expression = "";
  justCalculated = false;
  updateDisplay(false);
}

function deleteLast() {
  if (justCalculated) {
    clearAll();
    return;
  }

  const functions = [
    "asin(", "acos(", "atan(", "sqrt(", "cbrt(",
    "floor(", "ceil(", "sin(", "cos(", "tan(",
    "log(", "ln(", "exp(", "abs("
  ];

  const found = functions.find(fn => expression.endsWith(fn));

  if (found) {
    expression = expression.slice(0, -found.length);
  } else {
    expression = expression.slice(0, -1);
  }

  updateDisplay();
}

function changeSign() {
  if (!expression) {
    expression = "-";
  } else if (justCalculated) {
    expression = "-(" + expression + ")";
  } else {
    expression = "-(" + expression + ")";
  }

  justCalculated = false;
  updateDisplay();
}

function calculateResult() {
  if (!expression) return;

  try {
    const original = expression;
    const answer = calculate(expression);
    const formatted = formatNumber(answer);

    historyItems.unshift({
      expression: original,
      result: formatted
    });

    historyItems = historyItems.slice(0, 50);

    resultDisplay.textContent = formatted;
    expressionDisplay.textContent =
      original.replace(/\*/g, "×").replace(/\//g, "÷");

    expression = String(answer);
    justCalculated = true;
  } catch (error) {
    resultDisplay.textContent = "Error";
    expressionDisplay.textContent = error.message || "Invalid expression";
  }
}

/* KEYPAD EVENTS */

document.querySelector(".keypad").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.insert !== undefined) {
    insertValue(button.dataset.insert);
  }

  if (button.dataset.action === "clear") clearAll();
  if (button.dataset.action === "delete") deleteLast();
  if (button.dataset.action === "equals") calculateResult();
  if (button.dataset.action === "sign") changeSign();
});

scientificPanel.addEventListener("click", event => {
  const button = event.target.closest("[data-insert]");
  if (button) insertValue(button.dataset.insert);
});

/* SCIENTIFIC PANEL */

$("scientificTab").addEventListener("click", () => {
  scientificPanel.classList.toggle("open");
  $("scientificTab").classList.toggle("active");
  $("basicTab").classList.toggle("active", !scientificPanel.classList.contains("open"));
});

$("basicTab").addEventListener("click", () => {
  scientificPanel.classList.remove("open");
  $("scientificTab").classList.remove("active");
  $("basicTab").classList.add("active");
});

/* ANGLE MODES */

function setAngleMode(mode) {
  angleMode = mode;
  $("degBtn").classList.toggle("active", mode === "DEG");
  $("radBtn").classList.toggle("active", mode === "RAD");
  updateDisplay();
}

$("degBtn").addEventListener("click", () => setAngleMode("DEG"));
$("radBtn").addEventListener("click", () => setAngleMode("RAD"));

/* REFRESH */

$("refreshBtn").addEventListener("click", () => {
  clearAll();
  setAngleMode("DEG");
  scientificPanel.classList.remove("open");
  $("scientificTab").classList.remove("active");
  $("basicTab").classList.add("active");
});

/* MODALS */

function openModal(title, content) {
  modalTitle.textContent = title;
  modalContent.innerHTML = "";
  modalContent.appendChild(content);
  modalBackdrop.classList.add("show");
}

$("closeModal").addEventListener("click", () => {
  modalBackdrop.classList.remove("show");
});

modalBackdrop.addEventListener("click", event => {
  if (event.target === modalBackdrop) {
    modalBackdrop.classList.remove("show");
  }
});

/* HISTORY */

$("historyBtn").addEventListener("click", () => {
  const container = document.createElement("div");

  if (!historyItems.length) {
    container.textContent = "No calculations yet.";
  } else {
    historyItems.forEach(item => {
      const entry = document.createElement("div");
      entry.className = "history-entry";

      const formula = document.createElement("span");
      formula.textContent = item.expression;

      const answer = document.createElement("strong");
      answer.textContent = "= " + item.result;

      entry.append(formula, answer);
      container.appendChild(entry);
    });
  }

  const clearHistory = document.createElement("button");
  clearHistory.textContent = "Clear History";
  clearHistory.addEventListener("click", () => {
    historyItems = [];
    modalContent.textContent = "History cleared.";
  });

  container.appendChild(clearHistory);
  openModal("Calculation History", container);
});

/* SETTINGS */

$("settingsBtn").addEventListener("click", () => {
  const container = document.createElement("div");

  const modeText = document.createElement("p");
  modeText.textContent = "Angle mode: " + angleMode;

  const info = document.createElement("p");
  info.textContent = "NOVA Scientific Calculator · Version 1.0";

  const reset = document.createElement("button");
  reset.textContent = "Reset Calculator";
  reset.addEventListener("click", () => {
    clearAll();
    setAngleMode("DEG");
    modalBackdrop.classList.remove("show");
  });

  container.append(modeText, info, reset);
  openModal("Settings", container);
});

/* OTHER TABS */

$("graphTab").addEventListener("click", () => {
  alert("Graph mode is coming in a future update.");
});

$("converterTab").addEventListener("click", () => {
  alert("Unit converter is coming in a future update.");
});

/* KEYBOARD SUPPORT */

document.addEventListener("keydown", event => {
  if (modalBackdrop.classList.contains("show")) {
    if (event.key === "Escape") modalBackdrop.classList.remove("show");
    return;
  }

  if (/^[0-9.]$/.test(event.key)) {
    insertValue(event.key);
  } else if (["+", "-", "*", "/", "^", "(", ")", "%", "!"].includes(event.key)) {
    insertValue(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculateResult();
  } else if (event.key === "Backspace") {
    deleteLast();
  } else if (event.key === "Escape") {
    clearAll();
  }
});

/* INITIAL DISPLAY */

updateDisplay(false);
