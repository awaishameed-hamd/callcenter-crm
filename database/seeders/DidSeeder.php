<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DidSeeder extends Seeder
{
    public function run(): void
    {
        // Clear fake clients that were previously seeded as DIDs
        DB::table('clients')->whereIn('campaign', ['Medicare', 'Final Expense', 'ACA'])
            ->whereNull('company_name')
            ->orWhereIn('company_name', ['Medicare', 'Final Expense', 'ACA'])
            ->delete();

        $campaigns = [
            ['prefix' => 'MD', 'campaign' => 'Medicare'],
            ['prefix' => 'FD', 'campaign' => 'Final Expense'],
            ['prefix' => 'AD', 'campaign' => 'ACA'],
        ];

        $rows = [];
        foreach ($campaigns as $c) {
            for ($i = 1; $i <= 20; $i++) {
                $rows[] = [
                    'did_code'   => $c['prefix'] . $i,
                    'campaign'   => $c['campaign'],
                    'is_active'  => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        DB::table('dids')->insertOrIgnore($rows);
    }
}
