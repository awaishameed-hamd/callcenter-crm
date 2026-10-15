<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ClientSeeder extends Seeder
{
    public function run(): void
    {
        $campaigns = [
            ['prefix' => 'MD', 'campaign' => 'Medicare',       'company' => 'Medicare'],
            ['prefix' => 'FD', 'campaign' => 'Final Expense',  'company' => 'Final Expense'],
            ['prefix' => 'AD', 'campaign' => 'ACA',            'company' => 'ACA'],
        ];

        $rows = [];

        foreach ($campaigns as $c) {
            for ($i = 1; $i <= 20; $i++) {
                $code   = $c['prefix'] . $i;
                $rows[] = [
                    'did_code'                 => $code,
                    'campaign'                 => $c['campaign'],
                    'company_name'             => $c['company'],
                    'display_name'             => $code,
                    'rate_of_sale_amount'      => null,
                    'rate_type'                => 'fixed',
                    'cycle_of_day'             => null,
                    'billing_start_after_days' => null,
                    'notes'                    => null,
                    'is_active'                => 1,
                    'created_at'               => now(),
                    'updated_at'               => now(),
                ];
            }
        }

        DB::table('clients')->insertOrIgnore($rows);
    }
}
