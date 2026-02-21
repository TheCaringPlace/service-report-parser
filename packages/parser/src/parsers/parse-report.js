import { parsePantryStats } from "../parsers/pantry-stats.js";
import { parseProgramStats } from "../parsers/program-stats.js";
import { parseServiceSummary } from "../parsers/service-summary.js";
import { identifyReport } from "../parsers/identify.js";

/**
 * @typedef {Object} TextResult
 * @property {string} text - The extracted text
 * @property {{text: string}[]} pages - The pages in the PDF
 */

/**
 * Parses a report based on the report type
 * @param {TextResult} result
 * @returns {Object} The parsed report
 */
export function parseReport(result) {
  let report = null;
  const reportType = identifyReport(result.text);
  if (reportType != null) {
    console.log(`Identified report type: ${reportType}`);
  }
  const pages = result.pages
    .slice(0, -1)
    .map((page) => page.text)
    .join("\n");
  switch (reportType) {
    case "pantry-stats":
      report = parsePantryStats(pages);
      break;
    case "program-stats":
      report = parseProgramStats(pages);
      break;
    case "service-summary":
      report = parseServiceSummary(pages);
      break;
    default:
      console.warn(`Unknown report type: ${reportType}`);
      return {};
  }
  return { reportType, ...report };
}
