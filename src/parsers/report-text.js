/**
 * Shared utilities for cleaning and preparing TARA report text extracted from PDFs.
 */

/**
 * Strips page separators, footers, and other PDF extraction noise from report text.
 * @param {string} text - Raw text from PDF extraction
 * @returns {string} Cleaned text
 */
export function cleanReportText(text) {
  return text
    .replace(/-- \d+ of \d+ --/g, "")
    .replace(/Page \d+ of \d+.*/g, "")
    .replace(/Report printed from TARA.*/g, "")
    .replace(/\d+ Kennedy Avenue, Cincinnati, OH.*/g, "")
    .replace(/Ph:.*Fax:.*/g, "")
    .replace(/This document was created with the Win2PDF.*/gs, "")
    .replace(/https:\/\/[^\s]+/g, "")
    .replace(/Visit.*purchase\/?/gs, "");
}

/**
 * Cleans report text and returns non-empty trimmed lines.
 * @param {string} text - Raw text from PDF extraction
 * @returns {string[]} Array of trimmed, non-empty lines
 */
export function toLines(text) {
  return cleanReportText(text)
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
