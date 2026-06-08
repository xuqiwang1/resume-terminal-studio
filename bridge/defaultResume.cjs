const fs = require("node:fs");
const path = require("node:path");

const templatePath = [
  path.resolve(__dirname, "../workspace-template/active-resume.json"),
  path.resolve(__dirname, "../workspace/active-resume.json")
].find((candidate) => fs.existsSync(candidate));

if (!templatePath) {
  throw new Error("Default resume template not found.");
}

const defaultResumeTemplate = JSON.parse(fs.readFileSync(templatePath, "utf8"));

function createDefaultResume() {
  return JSON.parse(JSON.stringify(defaultResumeTemplate));
}

module.exports = {
  createDefaultResume,
  defaultResumeTemplate
};
