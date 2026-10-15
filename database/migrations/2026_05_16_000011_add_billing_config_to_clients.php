<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->integer('billing_cycle_days')->default(7)->after('billing_start_after_days');
            $table->enum('billing_start_after', ['first_approved', 'first_final_approved'])
                  ->default('first_approved')->after('billing_cycle_days');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['billing_cycle_days', 'billing_start_after']);
        });
    }
};
