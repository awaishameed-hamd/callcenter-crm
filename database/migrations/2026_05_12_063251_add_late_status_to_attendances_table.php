<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE attendances MODIFY COLUMN status ENUM('present','absent','weekend','leave','late') NOT NULL DEFAULT 'present'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE attendances MODIFY COLUMN status ENUM('present','absent','weekend','leave') NOT NULL DEFAULT 'present'");
    }
};
