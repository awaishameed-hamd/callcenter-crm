<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('voucher_number', 30)->unique();
            $table->string('voucher_type', 10);                 // BPV, CPV, BRV, CRV, JV, SR, INV, BILL, CHQ
            $table->date('date');
            $table->unsignedBigInteger('party_id')->nullable();
            $table->unsignedBigInteger('payment_account_id')->nullable();
            $table->string('payment_method', 30)->nullable();   // cash, cheque, bank_transfer, online
            $table->string('reference_number', 100)->nullable();
            $table->string('currency', 10)->default('PKR');
            $table->decimal('exchange_rate', 15, 6)->default(1.000000);
            $table->text('memo')->nullable();
            $table->enum('status', ['draft', 'posted', 'reversed'])->default('draft');
            $table->unsignedBigInteger('linked_voucher_id')->nullable();    // JV ↔ PV link
            $table->unsignedBigInteger('reversal_of_id')->nullable();       // Original voucher if this is a reversal
            $table->boolean('is_adjusting')->default(false);
            $table->boolean('is_recurring')->default(false);
            $table->string('recurring_frequency', 20)->nullable();          // monthly, weekly, etc.
            $table->date('recurring_end_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('party_id')->references('id')->on('accounting_parties')->nullOnDelete();
            $table->foreign('payment_account_id')->references('id')->on('accounts')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['voucher_type', 'date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vouchers');
    }
};
