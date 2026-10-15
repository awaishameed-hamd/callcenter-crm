<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rebuilds every account_code using the structured 9-digit technique:
 *
 *   L1 (1 digit)  +  L2 (1 digit)  +  L3 (1 digit)  +  L4 (1 digit)  +  L5 (1 digit)  +  seq (4 digits)
 *
 * Examples:
 *   Cost of Head-office Building  →  1-1-1-1-2-0001  =  111120001
 *   Accumulated Dep. of Laptop    →  1-1-1-2-3-0001  =  111230001
 *   Revenue from sales of bikes   →  4-6-1-1-0-0001  =  461100001
 */
return new class extends Migration
{
    // ── Level digit maps  (must match frontend CODE_* constants exactly) ─────

    private const L1 = [
        'Assets'      => 1,
        'Equity'      => 2,
        'Liabilities' => 3,
        'Revenue'     => 4,   // DB stores 'Revenue' for income accounts
        'Expenses'    => 5,
    ];

    private const L2 = [
        // Assets
        'Non-Current Assets'            => 1,
        'Current Assets'                => 2,
        // Equity (both sub-types collapse to 3)
        'Share Capital'                 => 3,
        'Reserves'                      => 3,
        // Liabilities
        'Non-Current Liabilities'       => 4,
        'Current Liabilities'           => 5,
        // Revenue / Other Income
        'Operating Revenue'             => 6,
        'Other Income'                  => 6,
        // Expenses
        'Cost of Revenue'               => 7,
        'Operating Expenses'            => 7,
        'Depreciation and Amortization' => 7,
        'Taxation'                      => 7,
        'Finance Costs'                 => 8,
    ];

    private const L3 = [
        // Non-Current Assets (L2 = 1)
        'Property, Plant & Equipment'    => 1,
        'Intangible Assets'              => 2,
        'Investment Properties'          => 3,
        'Capital Work in Progress'       => 4,
        'Right of Use Assets'            => 5,
        'Long-term Investments'          => 6,
        'Other Non-Current Assets'       => 7,
        // Current Assets (L2 = 2)
        'Cash and Cash Equivalents'      => 1,
        'Bank Accounts'                  => 2,
        'Accounts Receivable'            => 3,
        'Prepaid Expenses'               => 4,
        'Inventory'                      => 5,
        'Other Current Assets'           => 6,
        // Equity — Share Capital (L2 = 3)
        'Paid-up Capital'                => 1,
        'Retained Earnings'              => 2,
        // Equity — Reserves (L2 = 3)
        'General Reserve'                => 1,
        'Revaluation Reserve'            => 2,
        // Non-Current Liabilities (L2 = 4)
        'Long-term Loans'                => 1,
        'Lease Liability'                => 2,
        'Concession Assets'              => 3,
        'Other Non-Current Liabilities'  => 4,
        // Current Liabilities (L2 = 5)
        'Accounts Payable'               => 1,
        'Accrued Liabilities'            => 2,
        'Short-term Loans'               => 3,
        'Tax Liabilities'                => 4,
        'Other Current Liabilities'      => 5,
        // Operating Revenue (L2 = 6)
        'Services Income'                => 1,
        'Commission Income'              => 2,
        'Other Revenue'                  => 3,
        // Other Income (L2 = 6)
        'Interest Income'                => 1,
        'Exchange Gain/Loss'             => 2,
        'Other Income'                   => 3,
        // Cost of Revenue (L2 = 7)
        'Direct Costs'                   => 1,
        // Operating Expenses (L2 = 7)
        'Salaries and Wages'             => 1,
        'Rent'                           => 2,
        'Utilities'                      => 3,
        'Communications'                 => 4,
        'Other Operating Expenses'       => 5,
        // Finance Costs (L2 = 8)
        'Interest Expense'               => 1,
        'Bank Charges'                   => 2,
        // Depreciation & Amortization (L2 = 7)
        'Depreciation'                   => 1,
        'Amortization'                   => 2,
        // Taxation (L2 = 7)
        'Taxation'                       => 1,
    ];

    /** Fixed Notes Classification (level_4) digits */
    private const L4_FIXED = [
        'Cost'                     => 1,
        'Accumulated Depreciation' => 2,
        'Accumulated Amortization' => 2,
    ];

    /** Fixed Sub Notes Classification (level_5) digits */
    private const L5_FIXED = [
        'Land'                   => 1,
        'Building'               => 2,
        'Buildings'              => 2,
        'Computers'              => 3,
        'Computer & IT Equipment'=> 3,
        'Computer Equipment'     => 3,
        'IT Equipment'           => 3,
    ];

    // ── Migration ─────────────────────────────────────────────────────────────

    public function up(): void
    {
        // Load all accounts ordered by ID (creation order = natural sequence)
        $accounts = DB::table('accounts')->orderBy('id')->get();

        // Dynamic digit registries — built up as we iterate
        // $l4Registry["level_2|level_3"]         → ['value' => digit, ...]
        // $l5Registry["level_2|level_3|level_4"] → ['value' => digit, ...]
        $l4Registry = [];
        $l5Registry = [];

        // Running sequence counter per 5-digit prefix
        // $seqCounter["11110"] → 3  means 3 accounts already assigned that prefix
        $seqCounter = [];

        foreach ($accounts as $acc) {

            // ── L1 digit ────────────────────────────────────────────────────
            $c1 = self::L1[$acc->level_1] ?? 0;

            // ── L2 digit ────────────────────────────────────────────────────
            $c2 = self::L2[$acc->level_2] ?? 0;

            // ── L3 digit ────────────────────────────────────────────────────
            $c3 = self::L3[$acc->level_3] ?? 0;

            // ── L4 digit ────────────────────────────────────────────────────
            $c4 = 0;
            if ($acc->level_4) {
                if (isset(self::L4_FIXED[$acc->level_4])) {
                    $c4 = self::L4_FIXED[$acc->level_4];
                } else {
                    $key = "{$acc->level_2}|{$acc->level_3}";
                    if (!isset($l4Registry[$key]))              $l4Registry[$key] = [];
                    if (isset($l4Registry[$key][$acc->level_4])) {
                        $c4 = $l4Registry[$key][$acc->level_4];
                    } else {
                        // Assign next unused digit (1-9) within this L2+L3 group
                        $used = array_values($l4Registry[$key]);
                        for ($i = 1; $i <= 9; $i++) {
                            if (!in_array($i, $used, true)) { $c4 = $i; break; }
                        }
                        $l4Registry[$key][$acc->level_4] = $c4;
                    }
                }
            }

            // ── L5 digit ────────────────────────────────────────────────────
            $c5 = 0;
            if ($acc->level_5) {
                if (isset(self::L5_FIXED[$acc->level_5])) {
                    $c5 = self::L5_FIXED[$acc->level_5];
                } else {
                    $key = "{$acc->level_2}|{$acc->level_3}|{$acc->level_4}";
                    if (!isset($l5Registry[$key]))              $l5Registry[$key] = [];
                    if (isset($l5Registry[$key][$acc->level_5])) {
                        $c5 = $l5Registry[$key][$acc->level_5];
                    } else {
                        $used = array_values($l5Registry[$key]);
                        for ($i = 1; $i <= 9; $i++) {
                            if (!in_array($i, $used, true)) { $c5 = $i; break; }
                        }
                        $l5Registry[$key][$acc->level_5] = $c5;
                    }
                }
            }

            // ── Sequence (4-digit, zero-padded) ─────────────────────────────
            $prefix = "{$c1}{$c2}{$c3}{$c4}{$c5}";
            $seqCounter[$prefix] = ($seqCounter[$prefix] ?? 0) + 1;
            $seq     = str_pad($seqCounter[$prefix], 4, '0', STR_PAD_LEFT);
            $newCode = "{$prefix}{$seq}";

            DB::table('accounts')
                ->where('id', $acc->id)
                ->update(['account_code' => $newCode]);
        }
    }

    public function down(): void
    {
        // Irreversible data migration — restore from backup if needed
    }
};
