<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('voucher_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('voucher_id');
            $table->unsignedBigInteger('account_id');
            $table->decimal('debit_pkr', 18, 2)->default(0.00);
            $table->decimal('credit_pkr', 18, 2)->default(0.00);
            $table->decimal('foreign_debit', 18, 2)->nullable();    // In foreign currency if applicable
            $table->decimal('foreign_credit', 18, 2)->nullable();
            $table->string('currency', 10)->default('PKR');
            $table->decimal('exchange_rate', 15, 6)->default(1.000000);
            $table->text('description')->nullable();
            $table->unsignedBigInteger('party_id')->nullable();
            $table->boolean('is_billable')->default(false);
            $table->string('project', 100)->nullable();
            $table->timestamps();

            $table->foreign('voucher_id')->references('id')->on('vouchers')->cascadeOnDelete();
            $table->foreign('account_id')->references('id')->on('accounts');
            $table->index(['account_id', 'voucher_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_lines');
    }
};
