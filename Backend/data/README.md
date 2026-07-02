# Import data files

Excel workbooks used by Backend import scripts live here.

- **`dapong-stocks.xlsx`** — committed to the repo for `scripts/import-dapong-products.js` (Sulas Enterprise / Dapong-spintex).
- **`sortings_capitalized.xlsx`** — same column layout (A=SKU, B=name, C=qty); use `--source data/sortings_capitalized.xlsx`.
- **Bravo Thrybe import** (`scripts/import-bravo-thrybe-products.js`) is matrix-driven and does not require an input workbook. Update the matrix constants in the script when product/variant combinations change.
- Other `*.xlsx` files in this folder are **gitignored**; upload them manually per environment if needed.
