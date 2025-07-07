// AWS Textract Financial Table Extractor
// Extracts structured financial data from documents using AWS Textract

export class FinancialTableExtractor {
  constructor() {
    this.tablePatterns = this._loadTablePatterns();
  }

  /**
   * Extract P&L data from Textract blocks
   */
  extractPnLFromTextract(textractBlocks) {
    // Store blocks for reference resolution
    this.setAllBlocks(textractBlocks);
    
    // Find P&L table
    const pnlTable = this._findPnLTable(textractBlocks);
    
    if (!pnlTable) {
      console.log('No P&L table found in Textract output');
      return {};
    }

    // Extract structure
    const headers = this._extractHeaders(pnlTable);
    const rows = this._extractRows(pnlTable);
    
    // Map to standard format
    const standardized = this._standardizePnL(headers, rows);
    
    return standardized;
  }

  /**
   * Extract all financial tables from document
   */
  extractAllFinancialTables(textractBlocks) {
    const tables = this._findAllTables(textractBlocks);
    const financialTables = [];

    for (const table of tables) {
      const tableType = this._identifyTableType(table);
      if (tableType) {
        financialTables.push({
          type: tableType,
          data: this._extractTableData(table)
        });
      }
    }

    return financialTables;
  }

  /**
   * Find P&L table in Textract blocks
   */
  _findPnLTable(blocks) {
    const tables = this._findAllTables(blocks);
    
    for (const table of tables) {
      const text = this._getTableText(table).toLowerCase();
      
      // Check for P&L indicators
      const pnlIndicators = [
        'income statement',
        'profit and loss',
        'p&l statement',
        'statement of operations',
        'statement of income',
        'revenue',
        'operating income',
        'ebitda',
        'net income'
      ];
      
      const matchCount = pnlIndicators.filter(indicator => text.includes(indicator)).length;
      if (matchCount >= 2) {
        return table;
      }
    }
    
    return null;
  }

  /**
   * Find all tables in Textract blocks
   */
  _findAllTables(blocks) {
    return blocks.filter(block => block.BlockType === 'TABLE');
  }

  /**
   * Extract headers from table
   */
  _extractHeaders(table) {
    const cells = this._getTableCells(table);
    const headerRow = cells.filter(cell => cell.RowIndex === 1);
    
    return headerRow
      .sort((a, b) => a.ColumnIndex - b.ColumnIndex)
      .map(cell => this._getCellText(cell));
  }

  /**
   * Extract rows from table
   */
  _extractRows(table) {
    const cells = this._getTableCells(table);
    const maxRow = Math.max(...cells.map(cell => cell.RowIndex));
    const rows = [];

    for (let rowIndex = 2; rowIndex <= maxRow; rowIndex++) {
      const rowCells = cells.filter(cell => cell.RowIndex === rowIndex);
      if (rowCells.length > 0) {
        const row = this._parseRowData(rowCells);
        if (row.label) {
          rows.push(row);
        }
      }
    }

    return rows;
  }

  /**
   * Get table cells from table block
   */
  _getTableCells(table) {
    const cells = [];
    
    if (table.Relationships) {
      for (const relationship of table.Relationships) {
        if (relationship.Type === 'CHILD') {
          for (const childId of relationship.Ids) {
            const cell = this._findBlockById(childId, this.allBlocks);
            if (cell && cell.BlockType === 'CELL') {
              cells.push(cell);
            }
          }
        }
      }
    }
    
    return cells;
  }

  /**
   * Parse row data from cells
   */
  _parseRowData(rowCells) {
    const sortedCells = rowCells.sort((a, b) => a.ColumnIndex - b.ColumnIndex);
    const row = {
      label: '',
      values: {}
    };

    sortedCells.forEach((cell, index) => {
      const text = this._getCellText(cell);
      if (index === 0) {
        row.label = text;
      } else {
        row.values[`col${index}`] = this._parseFinancialValue(text);
      }
    });

    return row;
  }

  /**
   * Get text from cell
   */
  _getCellText(cell) {
    let text = '';
    
    if (cell.Relationships) {
      for (const relationship of cell.Relationships) {
        if (relationship.Type === 'CHILD') {
          for (const childId of relationship.Ids) {
            const word = this._findBlockById(childId, this.allBlocks);
            if (word && word.BlockType === 'WORD') {
              text += word.Text + ' ';
            }
          }
        }
      }
    }
    
    return text.trim();
  }

  /**
   * Get all text from table
   */
  _getTableText(table) {
    const cells = this._getTableCells(table);
    return cells.map(cell => this._getCellText(cell)).join(' ');
  }

  /**
   * Standardize P&L data to common format
   */
  _standardizePnL(headers, rows) {
    const yearColumns = this._identifyYearColumns(headers);
    
    const standardized = {
      years: yearColumns,
      revenue: this._extractRevenueRows(rows, yearColumns),
      cogs: this._extractCogsRows(rows, yearColumns),
      grossProfit: this._extractGrossProfitRows(rows, yearColumns),
      operatingExpenses: this._extractExpenseRows(rows, yearColumns),
      ebitda: this._extractOrCalculateEbitda(rows, yearColumns),
      netIncome: this._extractNetIncomeRows(rows, yearColumns),
      adjustments: this._extractAdjustments(rows, yearColumns)
    };
    
    return standardized;
  }

  /**
   * Identify year columns from headers
   */
  _identifyYearColumns(headers) {
    const years = {};
    
    headers.forEach((header, index) => {
      // Match year patterns: 2021, FY2021, CY 2021, etc.
      const yearMatch = header.match(/(\d{4})/);
      if (yearMatch) {
        years[yearMatch[1]] = index;
      }
      // Match relative periods
      else if (header.toLowerCase().includes('ttm')) {
        years['TTM'] = index;
      }
      else if (header.toLowerCase().includes('ltm')) {
        years['LTM'] = index;
      }
    });
    
    return years;
  }

  /**
   * Extract revenue rows with pattern matching
   */
  _extractRevenueRows(rows, yearColumns) {
    const revenuePatterns = [
      /^(total\s+)?revenue/i,
      /^(total\s+)?sales/i,
      /^(gross\s+)?income/i,
      /^top\s+line/i,
      /^net\s+revenue/i,
      /^gross\s+revenue/i,
      /^commission\s+(income|revenue)/i
    ];
    
    const results = {};
    
    for (const row of rows) {
      for (const pattern of revenuePatterns) {
        if (pattern.test(row.label)) {
          Object.entries(yearColumns).forEach(([year, colIndex]) => {
            const value = row.values[`col${colIndex}`];
            if (value) {
              results[year] = (results[year] || 0) + value;
            }
          });
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Extract COGS rows
   */
  _extractCogsRows(rows, yearColumns) {
    const cogsPatterns = [
      /^(cost\s+of\s+goods\s+sold|cogs)/i,
      /^(cost\s+of\s+sales|cos)/i,
      /^(cost\s+of\s+revenue)/i,
      /^direct\s+cost/i
    ];
    
    const results = {};
    
    for (const row of rows) {
      for (const pattern of cogsPatterns) {
        if (pattern.test(row.label)) {
          Object.entries(yearColumns).forEach(([year, colIndex]) => {
            const value = row.values[`col${colIndex}`];
            if (value) {
              results[year] = value;
            }
          });
          return results;
        }
      }
    }
    
    return results;
  }

  /**
   * Extract gross profit rows
   */
  _extractGrossProfitRows(rows, yearColumns) {
    const grossProfitPatterns = [
      /^gross\s+profit/i,
      /^gross\s+margin/i
    ];
    
    const results = {};
    
    for (const row of rows) {
      for (const pattern of grossProfitPatterns) {
        if (pattern.test(row.label)) {
          Object.entries(yearColumns).forEach(([year, colIndex]) => {
            const value = row.values[`col${colIndex}`];
            if (value) {
              results[year] = value;
            }
          });
          return results;
        }
      }
    }
    
    return results;
  }

  /**
   * Extract operating expense rows
   */
  _extractExpenseRows(rows, yearColumns) {
    const expensePatterns = [
      /^(total\s+)?operating\s+expense/i,
      /^(total\s+)?expense/i,
      /^sg&a/i,
      /^general\s+&\s+administrative/i,
      /^selling\s+expense/i,
      /^marketing\s+expense/i
    ];
    
    const results = {};
    const expenseItems = [];
    
    for (const row of rows) {
      for (const pattern of expensePatterns) {
        if (pattern.test(row.label)) {
          expenseItems.push(row);
          break;
        }
      }
    }
    
    // Sum all expense items by year
    Object.entries(yearColumns).forEach(([year, colIndex]) => {
      results[year] = expenseItems.reduce((sum, row) => {
        const value = row.values[`col${colIndex}`] || 0;
        return sum + value;
      }, 0);
    });
    
    return results;
  }

  /**
   * Extract or calculate EBITDA
   */
  _extractOrCalculateEbitda(rows, yearColumns) {
    // First try to find explicit EBITDA
    const ebitdaPatterns = [
      /^(adjusted\s+)?ebitda/i,
      /^(normalized\s+)?ebitda/i,
      /^ebitda\s+\(/i
    ];
    
    for (const row of rows) {
      for (const pattern of ebitdaPatterns) {
        if (pattern.test(row.label)) {
          const results = {};
          Object.entries(yearColumns).forEach(([year, colIndex]) => {
            const value = row.values[`col${colIndex}`];
            if (value) {
              results[year] = value;
            }
          });
          return results;
        }
      }
    }
    
    // If not found, try to calculate from operating income
    const operatingIncomePatterns = [
      /^operating\s+(income|profit)/i,
      /^(income|profit)\s+from\s+operations/i,
      /^ebit(?!da)/i
    ];
    
    for (const row of rows) {
      for (const pattern of operatingIncomePatterns) {
        if (pattern.test(row.label)) {
          // Add back D&A if available
          const results = {};
          Object.entries(yearColumns).forEach(([year, colIndex]) => {
            const value = row.values[`col${colIndex}`];
            if (value) {
              results[year] = value;
              // Look for D&A to add back
              const daRow = rows.find(r => /depreciation|amortization|d&a/i.test(r.label));
              if (daRow && daRow.values[`col${colIndex}`]) {
                results[year] += Math.abs(daRow.values[`col${colIndex}`]);
              }
            }
          });
          return results;
        }
      }
    }
    
    return {};
  }

  /**
   * Extract net income rows
   */
  _extractNetIncomeRows(rows, yearColumns) {
    const netIncomePatterns = [
      /^net\s+(income|profit|earnings)/i,
      /^(profit|loss)\s+after\s+tax/i,
      /^bottom\s+line/i
    ];
    
    const results = {};
    
    for (const row of rows) {
      for (const pattern of netIncomePatterns) {
        if (pattern.test(row.label)) {
          Object.entries(yearColumns).forEach(([year, colIndex]) => {
            const value = row.values[`col${colIndex}`];
            if (value) {
              results[year] = value;
            }
          });
          return results;
        }
      }
    }
    
    return results;
  }

  /**
   * Extract adjustments and add-backs
   */
  _extractAdjustments(rows, yearColumns) {
    const adjustmentPatterns = [
      /^add[\s-:]?back/i,
      /^adjustment/i,
      /^one[\s-]?time/i,
      /^extraordinary/i,
      /^non[\s-]?recurring/i,
      /^owner[\s-]?(compensation|salary)/i
    ];
    
    const adjustments = [];
    
    for (const row of rows) {
      for (const pattern of adjustmentPatterns) {
        if (pattern.test(row.label)) {
          const adjustment = {
            label: row.label,
            values: {}
          };
          
          Object.entries(yearColumns).forEach(([year, colIndex]) => {
            const value = row.values[`col${colIndex}`];
            if (value) {
              adjustment.values[year] = value;
            }
          });
          
          adjustments.push(adjustment);
          break;
        }
      }
    }
    
    return adjustments;
  }

  /**
   * Parse financial value from text
   */
  _parseFinancialValue(text) {
    if (!text) return null;
    
    // Remove currency symbols and clean up
    let cleaned = text.replace(/[$,]/g, '').trim();
    
    // Handle parentheses for negative numbers
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }
    
    // Handle thousands/millions notation
    const multipliers = {
      'k': 1000,
      'm': 1000000,
      'mm': 1000000,
      'b': 1000000000
    };
    
    const match = cleaned.match(/^(-?\d+\.?\d*)\s*([kmb]+)?$/i);
    if (match) {
      const number = parseFloat(match[1]);
      const multiplier = multipliers[match[2]?.toLowerCase()] || 1;
      return number * multiplier;
    }
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Identify table type from content
   */
  _identifyTableType(table) {
    const text = this._getTableText(table).toLowerCase();
    
    const tableTypes = {
      'income_statement': ['income statement', 'profit and loss', 'p&l', 'revenue', 'ebitda'],
      'balance_sheet': ['balance sheet', 'assets', 'liabilities', 'equity', 'current assets'],
      'cash_flow': ['cash flow', 'operating activities', 'investing activities', 'financing activities'],
      'metrics': ['key metrics', 'kpi', 'performance metrics', 'operational metrics']
    };
    
    for (const [type, indicators] of Object.entries(tableTypes)) {
      const matchCount = indicators.filter(indicator => text.includes(indicator)).length;
      if (matchCount >= 2) {
        return type;
      }
    }
    
    return null;
  }

  /**
   * Extract data from any table type
   */
  _extractTableData(table) {
    const headers = this._extractHeaders(table);
    const rows = this._extractRows(table);
    
    return {
      headers,
      rows: rows.map(row => ({
        label: row.label,
        values: Object.values(row.values)
      }))
    };
  }

  /**
   * Load table patterns configuration
   */
  _loadTablePatterns() {
    return {
      revenue: [
        /^(total\s+)?revenue/i,
        /^(total\s+)?sales/i,
        /^(gross\s+)?income/i,
        /^net\s+revenue/i,
        /^commission\s+(income|revenue)/i
      ],
      expenses: [
        /^(total\s+)?operating\s+expense/i,
        /^sg&a/i,
        /^general\s+&\s+administrative/i
      ],
      profitability: [
        /^(adjusted\s+)?ebitda/i,
        /^operating\s+(income|profit)/i,
        /^net\s+(income|profit)/i
      ]
    };
  }

  /**
   * Helper to find block by ID
   */
  _findBlockById(id, allBlocks) {
    if (!allBlocks) {
      console.warn('No blocks provided to _findBlockById');
      return null;
    }
    return allBlocks.find(block => block.Id === id) || null;
  }

  /**
   * Set all blocks for reference resolution
   */
  setAllBlocks(blocks) {
    this.allBlocks = blocks;
  }
}

// Export for use in API endpoints
export default FinancialTableExtractor;