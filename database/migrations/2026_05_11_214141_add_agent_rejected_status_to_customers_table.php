<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE customers MODIFY COLUMN status ENUM(
            'pending','approved','disapproved','final_approved','final_disapproved','agent_rejected'
        ) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE customers MODIFY COLUMN status ENUM(
            'pending','approved','disapproved','final_approved','final_disapproved'
        ) NOT NULL DEFAULT 'pending'");
    }
};
