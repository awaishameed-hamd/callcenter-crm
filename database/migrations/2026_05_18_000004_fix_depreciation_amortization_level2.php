<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * "Depreciation and Amortization" was incorrectly placed as a level_2 (Main Classification).
 * It is actually a Notes Classification (level_4).
 *
 * Fix: move these accounts to level_2 = 'Operating Expenses', keeping level_3 as-is
 * (Depreciation / Amortization), then recompute their account codes.
 *
 * Administrative Expenses is now a new level_2 option (CODE_L2 digit = 9).
 * No existing accounts need migration for that — it's brand new.
 */
return new class extends Migration
{
    // ── Same digit maps as migration 000003 (kept in sync) ──────────────────

    private const L1 = [
        'Assets' => 1, 'Equity' => 2, 'Liabilities' => 3, 'Revenue' => 4, 'Expenses' => 5,
    ];

    private const L2 = [
        'Non-Current Assets'       => 1,
        'Current Assets'           => 2,
        'Share Capital'            => 3,
        'Reserves'                 => 3,
        'Non-Current Liabilities'  => 4,
        'Current Liabilities'      => 5,
        'Operating Revenue'        => 6,
        'Other Income'             => 6,
        'Cost of Revenue'          => 7,
        'Administrative Expenses'  => 9,   // new
        'Operating Expenses'       => 7,
        'Taxation'                 => 7,
        'Finance Costs'            => 8,
        // 'Depreciation and Amortization' intentionally removed → was wrong at L2
    ];

    private const L3 = [
        'Property, Plant & Equipment'    => 1,
        'Intangible Assets'              => 2,
        'Investment Properties'          => 3,
        'Capital Work in Progress'       => 4,
        'Right of Use Assets'            => 5,
        'Long-term Investments'          => 6,
        'Other Non-Current Assets'       => 7,
        'Cash and Cash Equivalents'      => 1,
        'Bank Accounts'                  => 2,
        'Accounts Receivable'            => 3,
        'Prepaid Expenses'               => 4,
        'Inventory'                      => 5,
        'Other Current Assets'           => 6,
        'Paid-up Capital'                => 1,
        'Retained Earnings'              => 2,
        'General Reserve'                => 1,
        'Revaluation Reserve'            => 2,
        'Long-term Loans'                => 1,
        'Lease Liability'                => 2,
        'Concession Assets'              => 3,
        'Other Non-Current Liabilities'  => 4,
        'Accounts Payable'               => 1,
        'Accrued Liabilities'            => 2,
        'Short-term Loans'               => 3,
        'Tax Liabilities'                => 4,
        'Other Current Liabilities'      => 5,
        'Services Income'                => 1,
        'Commission Income'              => 2,
        'Other Revenue'                  => 3,
        'Interest Income'                => 1,
        'Exchange Gain/Loss'             => 2,
        'Other Income'                   => 3,
        'Direct Costs'                   => 1,
        'Salaries and Wages'             => 1,
        'Rent'                           => 2,
        'Utilities'                      => 3,
        'Communications'                 => 4,
        'Other Administrative Expenses'  => 5,
        'Other Operating Expenses'       => 5,
        'Interest Expense'               => 1,
        'Bank Charges'                   => 2,
        'Depreciation'                   => 1,   // now an L3 under Operating Expenses
        'Amortization'                   => 2,   // now an L3 under Operating Expenses
        'Taxation'                       => 1,
    ];

    private const L4_FIXED = [
        'Cost'                     => 1,
        'Accumulated Depreciation' => 2,
        'Accumulated Amortization' => 2,
    ];

    private const L5_FIXED = [
        'Land'                    => 1,
        'Building'                => 2,
        'Buildings'               => 2,
        'Computers'               => 3,
        'Computer & IT Equipment' => 3,
        'Computer Equipment'      => 3,
        'IT Equipment'            => 3,
    ];

    // ── Migration ─────────────────────────────────────────────────────────────

    public function up(): void
    {
        // Step 1 — Move D&A accounts to Operating Expenses
        DB::table('accounts')
            ->where('level_2', 'Depreciation and Amortization')
            ->update(['level_2' => 'Operating Expenses']);

        // Step 2 — Recompute ALL account codes from scratch
        // (because moving D&A accounts changes prefix and sequence for Operating Expenses)
        $accounts = DB::table('accounts')->orderBy('id')->get();

        $l4Registry = [];
        $l5Registry = [];
        $seqCounter = [];

        foreach ($accounts as $acc) {
            $c1 = self::L1[$acc->level_1] ?? 0;
            $c2 = self::L2[$acc->level_2] ?? 0;
            $c3 = self::L3[$acc->level_3] ?? 0;

            // L4 digit
            $c4 = 0;
            if ($acc->level_4) {
                if (isset(self::L4_FIXED[$acc->level_4])) {
                    $c4 = self::L4_FIXED[$acc->level_4];
                } else {
                    $key = "{$acc->level_2}|{$acc->level_3}";
                    if (!isset($l4Registry[$key])) $l4Registry[$key] = [];
                    if (isset($l4Registry[$key][$acc->level_4])) {
                        $c4 = $l4Registry[$key][$acc->level_4];
                    } else {
                        $used = array_values($l4Registry[$key]);
                        for ($i = 1; $i <= 9; $i++) {
                            if (!in_array($i, $used, true)) { $c4 = $i; break; }
                        }
                        $l4Registry[$key][$acc->level_4] = $c4;
                    }
                }
            }

            // L5 digit
            $c5 = 0;
            if ($acc->level_5) {
                if (isset(self::L5_FIXED[$acc->level_5])) {
                    $c5 = self::L5_FIXED[$acc->level_5];
                } else {
                    $key = "{$acc->level_2}|{$acc->level_3}|{$acc->level_4}";
                    if (!isset($l5Registry[$key])) $l5Registry[$key] = [];
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

            $prefix = "{$c1}{$c2}{$c3}{$c4}{$c5}";
            $seqCounter[$prefix] = ($seqCounter[$prefix] ?? 0) + 1;
            $seq     = str_pad($seqCounter[$prefix], 4, '0', STR_PAD_LEFT);
            $newCode = "{$prefix}{$seq}";

            DB::table('accounts')->where('id', $acc->id)->update(['account_code' => $newCode]);
        }
    }

    public function down(): void
    {
        // Irreversible — restore from backup if needed
    }
};
