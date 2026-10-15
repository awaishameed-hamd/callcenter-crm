<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number', 30)->unique();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->date('billing_period_start');
            $table->date('billing_period_end');
            $table->decimal('subtotal',     12, 2)->default(0);
            $table->decimal('discount',     12, 2)->default(0);
            $table->decimal('adjustment',   12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('status', ['pending', 'sent', 'overdue', 'paid'])->default('pending');
            $table->date('invoice_date');
            $table->date('due_date');
            $table->date('payment_received_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['client_id', 'status']);
            $table->index(['client_id', 'billing_period_start', 'billing_period_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
