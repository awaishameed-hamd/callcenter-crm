<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coa_classes', function (Blueprint $table) {
            $table->id();
            $table->tinyInteger('level');                        // 2=Main, 3=Sub, 4=Notes, 5=SubNotes
            $table->string('name');
            $table->unsignedBigInteger('parent_id')->nullable(); // FK → coa_classes.id
            $table->string('account_type')->nullable();          // asset|liability|equity|revenue|expense (L2 only)
            $table->tinyInteger('code_digit')->nullable();       // digit used in account code at this level
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('coa_classes')->onDelete('cascade');
        });

        $this->seed();
    }

    // ── Seeder ────────────────────────────────────────────────────────────────
    private function seed(): void
    {
        $now = now();

        // ── Level 2 — Main Classification ────────────────────────────────────
        $l2 = [
            ['Non-Current Assets',       'asset',     1],
            ['Current Assets',           'asset',     2],
            ['Share Capital',            'equity',    3],
            ['Reserves',                 'equity',    3],
            ['Non-Current Liabilities',  'liability', 4],
            ['Current Liabilities',      'liability', 5],
            ['Operating Revenue',        'revenue',   6],
            ['Other Income',             'revenue',   6],
            ['Cost of Revenue',          'expense',   7],
            ['Administrative Expenses',  'expense',   9],
            ['Operating Expenses',       'expense',   7],
            ['Finance Costs',            'expense',   8],
            ['Taxation',                 'expense',   7],
        ];
        $l2Ids = [];
        foreach ($l2 as [$name, $type, $digit]) {
            $l2Ids[$name] = DB::table('coa_classes')->insertGetId([
                'level' => 2, 'name' => $name, 'account_type' => $type,
                'code_digit' => $digit, 'is_active' => true,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Level 3 — Sub Classification ─────────────────────────────────────
        $l3 = [
            // Non-Current Assets
            ['Property, Plant & Equipment',   'Non-Current Assets', 1],
            ['Intangible Assets',             'Non-Current Assets', 2],
            ['Investment Properties',         'Non-Current Assets', 3],
            ['Capital Work in Progress',      'Non-Current Assets', 4],
            ['Right of Use Assets',           'Non-Current Assets', 5],
            ['Long-term Investments',         'Non-Current Assets', 6],
            ['Other Non-Current Assets',      'Non-Current Assets', 7],
            // Current Assets
            ['Cash and Cash Equivalents',     'Current Assets',     1],
            ['Bank Accounts',                 'Current Assets',     2],
            ['Accounts Receivable',           'Current Assets',     3],
            ['Prepaid Expenses',              'Current Assets',     4],
            ['Inventory',                     'Current Assets',     5],
            ['Other Current Assets',          'Current Assets',     6],
            // Equity
            ['Paid-up Capital',               'Share Capital',      1],
            ['Retained Earnings',             'Share Capital',      2],
            ['General Reserve',               'Reserves',           1],
            ['Revaluation Reserve',           'Reserves',           2],
            // Liabilities
            ['Long-term Loans',               'Non-Current Liabilities', 1],
            ['Lease Liability',               'Non-Current Liabilities', 2],
            ['Concession Assets',             'Non-Current Liabilities', 3],
            ['Other Non-Current Liabilities', 'Non-Current Liabilities', 4],
            ['Accounts Payable',              'Current Liabilities', 1],
            ['Accrued Liabilities',           'Current Liabilities', 2],
            ['Short-term Loans',              'Current Liabilities', 3],
            ['Tax Liabilities',               'Current Liabilities', 4],
            ['Other Current Liabilities',     'Current Liabilities', 5],
            // Revenue
            ['Services Income',               'Operating Revenue',  1],
            ['Commission Income',             'Operating Revenue',  2],
            ['Other Revenue',                 'Operating Revenue',  3],
            ['Interest Income',               'Other Income',       1],
            ['Exchange Gain/Loss',            'Other Income',       2],
            ['Other Income',                  'Other Income',       3],
            // Expenses — Cost of Revenue
            ['Direct Costs',                  'Cost of Revenue',    1],
            // Expenses — Administrative
            ['Salaries and Wages',            'Administrative Expenses', 1],
            ['Rent',                          'Administrative Expenses', 2],
            ['Utilities',                     'Administrative Expenses', 3],
            ['Communications',                'Administrative Expenses', 4],
            ['Other Administrative Expenses', 'Administrative Expenses', 5],
            // Expenses — Operating
            ['Salaries and Wages',            'Operating Expenses', 1],
            ['Rent',                          'Operating Expenses', 2],
            ['Utilities',                     'Operating Expenses', 3],
            ['Communications',               'Operating Expenses', 4],
            ['Depreciation',                  'Operating Expenses', 1],
            ['Amortization',                  'Operating Expenses', 2],
            ['Other Operating Expenses',      'Operating Expenses', 5],
            // Finance Costs
            ['Interest Expense',              'Finance Costs',      1],
            ['Bank Charges',                  'Finance Costs',      2],
            ['Exchange Gain/Loss',            'Finance Costs',      3],
            // Taxation
            ['Taxation',                      'Taxation',           1],
        ];
        $l3Ids = [];
        foreach ($l3 as [$name, $parentName, $digit]) {
            $parentId = $l2Ids[$parentName] ?? null;
            // Allow duplicate names under different parents — key by "name|parentId"
            $key = "{$name}|{$parentId}";
            $l3Ids[$key] = DB::table('coa_classes')->insertGetId([
                'level' => 3, 'name' => $name, 'parent_id' => $parentId,
                'code_digit' => $digit, 'is_active' => true,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Level 4 — Notes Classification ───────────────────────────────────
        // Helper: find L3 id by name + L2 parent name
        $getL3Id = function (string $l3Name, string $l2Name) use ($l2Ids, $l3Ids): ?int {
            $parentId = $l2Ids[$l2Name] ?? null;
            return $l3Ids["{$l3Name}|{$parentId}"] ?? null;
        };

        $l4 = [
            // PPE
            ['Cost',                     'Property, Plant & Equipment', 'Non-Current Assets', 1],
            ['Accumulated Depreciation', 'Property, Plant & Equipment', 'Non-Current Assets', 2],
            ['Revaluation Surplus',      'Property, Plant & Equipment', 'Non-Current Assets', 3],
            ['Impairment',               'Property, Plant & Equipment', 'Non-Current Assets', 4],
            // Intangibles
            ['Cost',                     'Intangible Assets',   'Non-Current Assets', 1],
            ['Accumulated Amortization', 'Intangible Assets',   'Non-Current Assets', 2],
            // Investment Properties
            ['Cost',                     'Investment Properties','Non-Current Assets', 1],
            ['Accumulated Depreciation', 'Investment Properties','Non-Current Assets', 2],
            // Right of Use Assets
            ['Cost',                     'Right of Use Assets', 'Non-Current Assets', 1],
            ['Accumulated Depreciation', 'Right of Use Assets', 'Non-Current Assets', 2],
        ];

        $l4Ids = [];
        foreach ($l4 as [$name, $l3Name, $l2Name, $digit]) {
            $parentId = $getL3Id($l3Name, $l2Name);
            $key = "{$name}|{$parentId}";
            $l4Ids[$key] = DB::table('coa_classes')->insertGetId([
                'level' => 4, 'name' => $name, 'parent_id' => $parentId,
                'code_digit' => $digit, 'is_active' => true,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Level 5 — Sub Notes Classification ───────────────────────────────
        // Common PPE sub-classes (under PPE > Cost)
        $ppeCostId = $l4Ids['Cost|' . $getL3Id('Property, Plant & Equipment', 'Non-Current Assets')] ?? null;
        $ppeAccDepId = $l4Ids['Accumulated Depreciation|' . $getL3Id('Property, Plant & Equipment', 'Non-Current Assets')] ?? null;

        $ppeSubClasses = [
            ['Land',                      1],
            ['Building',                  2],
            ['Computer & IT Equipment',   3],
            ['Motor Vehicles',            4],
            ['Furniture & Fixtures',      5],
            ['Office Equipment',          6],
            ['Plant & Machinery',         7],
            ['Leasehold Improvements',    8],
            ['Right of Use Asset',        9],
        ];

        foreach ($ppeSubClasses as [$name, $digit]) {
            // Under PPE > Cost
            if ($ppeCostId) {
                DB::table('coa_classes')->insert([
                    'level' => 5, 'name' => $name, 'parent_id' => $ppeCostId,
                    'code_digit' => $digit, 'is_active' => true,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
            // Mirror under PPE > Accumulated Depreciation (same digits)
            if ($ppeAccDepId) {
                DB::table('coa_classes')->insert([
                    'level' => 5, 'name' => $name, 'parent_id' => $ppeAccDepId,
                    'code_digit' => $digit, 'is_active' => true,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // Intangibles L5 (under Intangibles > Cost)
        $intCostId = $l4Ids['Cost|' . $getL3Id('Intangible Assets', 'Non-Current Assets')] ?? null;
        $intAmortId = $l4Ids['Accumulated Amortization|' . $getL3Id('Intangible Assets', 'Non-Current Assets')] ?? null;

        $intSubClasses = [
            ['Software Licenses',   1],
            ['Patents & Trademarks',2],
            ['Goodwill',            3],
            ['Other Intangibles',   4],
        ];
        foreach ($intSubClasses as [$name, $digit]) {
            foreach (array_filter([$intCostId, $intAmortId]) as $pid) {
                DB::table('coa_classes')->insert([
                    'level' => 5, 'name' => $name, 'parent_id' => $pid,
                    'code_digit' => $digit, 'is_active' => true,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('coa_classes');
    }
};
