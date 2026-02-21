import { parseFile } from "fast-csv";
import { join } from "path";
import { writeFileWithMkdir } from "./fs.js";
import { readdir } from "fs/promises";

/**
 * Parse a currency amount string (e.g. " 1,628.14 " or " 43,533.10 ") to a number.
 * Empty or invalid values return 0.
 * @param {string} value
 * @returns {number}
 */
function parseAmount(value) {
  if (value == null || String(value).trim() === "") return 0;
  const cleaned = String(value).replace(/[,\s$]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Read and parse a financial CSV file.
 * @param {string} filePath
 * @returns {Promise<Array<{year: number, category: string, source: string, amount: number}>>}
 */
async function parseFinancialCsv(filePath) {
  const rows = [];
  return new Promise((resolve, reject) => {
    parseFile(filePath, { headers: true, trim: true })
      .on("data", (row) => {
        const year = parseInt(row.Year, 10);
        if (Number.isNaN(year)) return;
        rows.push({
          year,
          category: row.Category || "",
          source: row.Source || "",
          amount: parseAmount(row.Amount),
        });
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

/**
 * Consolidate financial CSV files into a single JSON structure.
 * @param {string} inputFolder - Folder containing Expenses and Income CSV files
 * @param {string} outputPath - Path for financials.json
 */
export async function consolidateFinancials(inputFolder, outputPath) {
  const files = await readdir(inputFolder);

  const expensesFile = files.find(
    (f) => f.toLowerCase().endsWith("expenses.csv"),
  );
  const incomeFile = files.find((f) => f.toLowerCase().endsWith("income.csv"));

  if (!expensesFile) {
    throw new Error(
      `No Expenses CSV found in ${inputFolder}. Expected a file ending with "Expenses.csv"`,
    );
  }
  if (!incomeFile) {
    throw new Error(
      `No Income CSV found in ${inputFolder}. Expected a file ending with "Income.csv"`,
    );
  }

  const [expensesRaw, incomeRaw] = await Promise.all([
    parseFinancialCsv(join(inputFolder, expensesFile)),
    parseFinancialCsv(join(inputFolder, incomeFile)),
  ]);

  const expenses = expensesRaw.map((r) => ({ ...r, type: "expense" }));
  const income = incomeRaw.map((r) => ({ ...r, type: "income" }));

  const allYears = [
    ...new Set([
      ...expenses.map((r) => r.year),
      ...income.map((r) => r.year),
    ]),
  ].sort((a, b) => a - b);

  const result = {
    expenses,
    income,
    years: allYears,
  };

  await writeFileWithMkdir(outputPath, JSON.stringify(result, null, 2));
  console.info(`Wrote financial data to ${outputPath}`);
}
