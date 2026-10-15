<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('mid_name')->nullable();
            $table->string('last_name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('alt_phone')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('nationality')->nullable();
            $table->string('country_of_residence')->nullable();
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country')->nullable();
            $table->string('postal_code')->nullable();
            $table->string('passport_no')->nullable();
            $table->string('national_id')->nullable();
            $table->enum('marital_status', ['single', 'married', 'divorced', 'widowed'])->nullable();
            $table->string('occupation')->nullable();
            $table->string('employer')->nullable();
            $table->decimal('annual_income', 15, 2)->nullable();
            $table->decimal('investment_amount', 15, 2)->nullable();
            $table->string('source')->nullable();
            $table->string('product_type')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'approved', 'disapproved', 'final_approved', 'final_disapproved'])->default('pending');
            $table->foreignId('agent_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
