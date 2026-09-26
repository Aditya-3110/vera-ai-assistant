const fs = require("fs");
const path = require("path");

const contexts = new Map();
const conversations = new Map();

const processedPath = path.join(__dirname, "processedTriggers.json");

let storedTriggers = [];

try {
  storedTriggers = JSON.parse(
    fs.readFileSync(processedPath, "utf8")
  );

  if (!Array.isArray(storedTriggers)) {
    storedTriggers = [];
  }
} catch (error) {
  storedTriggers = [];
}

const processedTriggers = new Set(storedTriggers);

function persistProcessedTriggers() {
  fs.writeFileSync(
    processedPath,
    JSON.stringify([...processedTriggers], null, 2)
  );
}

module.exports = {
  contexts,
  conversations,
  processedTriggers,
  persistProcessedTriggers,
};