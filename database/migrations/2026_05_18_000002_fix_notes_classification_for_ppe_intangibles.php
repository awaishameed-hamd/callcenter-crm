<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $accounts = DB::table('accounts')
            ->whereIn('level_3', ['Property, Plant & Equipment', 'Intangible Assets', 'Investment Properties'])
            ->get();

        $validNotes = ['Cost', 'Accumulated Depreciation', 'Accumulated Amortization'];

        foreach ($accounts as $acc) {
            $name  = strtolower($acc->account_name);
            $isIntangible = $acc->level_3 === 'Intangible Assets';

            // If level_4 is already a valid Notes Classification, keep it
            if (in_array($acc->level_4, $validNotes)) {
                $notesClass = $acc->level_4;
            } else {
                // Determine from account name
                $isAccumulated = str_contains($name, 'dep')
                    || str_contains($name, 'acc.')
                    || str_contains($name, 'amort')
                    || str_contains($name, 'depreciation')
                    || str_contains($name, 'amortization');

                $notesClass = $isAccumulated
                    ? ($isIntangible ? 'Accumulated Amortization' : 'Accumulated Depreciation')
                    : 'Cost';
            }

            // If level_5 is null, promote current level_4 to level_5
            $subNotes = $acc->level_5 ?? ($acc->level_4 && !in_array($acc->level_4, ['Cost', 'Accumulated Depreciation', 'Accumulated Amortization'])
                ? $acc->level_4
                : null);

            DB::table('accounts')->where('id', $acc->id)->update([
                'level_4' => $notesClass,
                'level_5' => $subNotes,
            ]);
        }
    }

    public function down(): void
    {
        // Irreversible data migration — restore from backup if needed
    }
};
