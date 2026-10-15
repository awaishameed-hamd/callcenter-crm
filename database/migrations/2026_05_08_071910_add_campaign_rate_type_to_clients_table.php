<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->enum('campaign', ['Medicare', 'Final Expense', 'ACA'])->nullable()->after('did_code');
            $table->enum('rate_type', ['fixed', 'variable'])->default('fixed')->after('rate_of_sale_amount');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['campaign', 'rate_type']);
        });
    }
};
