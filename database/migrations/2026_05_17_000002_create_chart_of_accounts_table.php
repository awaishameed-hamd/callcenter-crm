<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('account_code', 20)->unique();
            $table->string('account_name');
            $table->string('level_1');                          // Assets / Liabilities / Equity / Revenue / Expenses
            $table->string('level_2');                          // Non-Current Assets, Current Assets, etc.
            $table->string('level_3');                          // Cash and Cash Equivalents, Bank Accounts, etc.
            $table->string('level_4')->nullable();              // Required for PPE, Intangibles, ROU, Lease Liability, Concession
            $table->enum('account_type', ['asset', 'liability', 'equity', 'revenue', 'expense']);
            $table->enum('normal_balance', ['debit', 'credit']);
            $table->string('currency', 10)->default('PKR');
            $table->boolean('is_posting')->default(true);       // Only posting accounts accept transaction lines
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('accounts')->nullOnDelete();
            $table->index(['level_1', 'level_2', 'level_3']);
            $table->index('account_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
