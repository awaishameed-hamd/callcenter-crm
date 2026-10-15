<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('did_code')->unique();
            $table->string('company_name');
            $table->string('display_name');
            $table->decimal('rate_of_sale_amount', 10, 2)->default(0);
            $table->integer('cycle_of_day')->default(0);
            $table->integer('billing_start_after_days')->default(0);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
