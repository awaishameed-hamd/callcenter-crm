<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('users')->insertOrIgnore([
            'username'     => 'admin',
            'password'     => Hash::make('Admin@123'),
            'role'         => 'admin',
            'display_name' => 'System Admin',
            'first_name'   => 'System',
            'last_name'    => 'Admin',
            'is_active'    => 1,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);
    }
}
