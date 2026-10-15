<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AttendanceSettingsSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('attendance_settings')->insertOrIgnore([
            [
                'key'        => 'late_margin_minutes',
                'value'      => '15',
                'label'      => 'Late Margin (minutes after login time)',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key'        => 'default_login_time',
                'value'      => '17:00',
                'label'      => 'Default Login Time (HH:MM 24hr)',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
