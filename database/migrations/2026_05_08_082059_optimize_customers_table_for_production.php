<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // Drop unused columns from the generic CRM template
            // These fields don't exist in a call-center workflow
            $table->dropColumn([
                'email',
                'alt_phone',
                'gender',
                'nationality',
                'country_of_residence',
                'country',
                'passport_no',
                'national_id',
                'marital_status',
                'occupation',
                'employer',
                'annual_income',
                'investment_amount',
                'source',
                'product_type',
            ]);

            // Indexes for the query patterns that run on every page load:
            // agent filters by agent_id + status (My Sales tabs)
            // manager/director filter by status + date (Approvals + Reports)
            // reports always order by created_at desc
            $table->index('status');
            $table->index('created_at');
            $table->index(['agent_id', 'status']);
            $table->index(['status', 'created_at']);
            $table->index(['client_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['created_at']);
            $table->dropIndex(['agent_id', 'status']);
            $table->dropIndex(['status', 'created_at']);
            $table->dropIndex(['client_id', 'created_at']);

            $table->string('email')->nullable();
            $table->string('alt_phone')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->string('nationality')->nullable();
            $table->string('country_of_residence')->nullable();
            $table->string('country')->nullable();
            $table->string('passport_no')->nullable();
            $table->string('national_id')->nullable();
            $table->enum('marital_status', ['single', 'married', 'divorced', 'widowed'])->nullable();
            $table->string('occupation')->nullable();
            $table->string('employer')->nullable();
            $table->decimal('annual_income', 15, 2)->nullable();
            $table->decimal('investment_amount', 15, 2)->nullable();
            $table->string('source')->nullable();
            $table->string('product_type')->nullable();
        });
    }
};
