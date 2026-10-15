<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('accounting_budgets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('account_id');
            $table->integer('fiscal_year');
            $table->integer('month');                           // 1–12
            $table->decimal('amount', 18, 2)->default(0.00);
            $table->timestamps();

            $table->unique(['account_id', 'fiscal_year', 'month']);
            $table->foreign('account_id')->references('id')->on('accounts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_budgets');
    }
};
