<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Variable-rate clients have no fixed rate_of_sale_amount — the rate is
     * determined per sale at final-approval time. Make the column nullable so
     * we can store NULL instead of a misleading 0.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->decimal('rate_of_sale_amount', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->decimal('rate_of_sale_amount', 10, 2)->default(0)->change();
        });
    }
};
