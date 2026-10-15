<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_code')->unique()->after('id');
            $table->text('manager_note')->nullable()->after('notes');
            $table->text('final_note')->nullable()->after('manager_note');
            $table->timestamp('approved_at')->nullable()->after('final_note');
            $table->timestamp('disapproved_at')->nullable()->after('approved_at');
            $table->timestamp('final_approved_at')->nullable()->after('disapproved_at');
            $table->timestamp('final_disapproved_at')->nullable()->after('final_approved_at');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique(['customer_code']);
            $table->dropColumn([
                'customer_code',
                'manager_note',
                'final_note',
                'approved_at',
                'disapproved_at',
                'final_approved_at',
                'final_disapproved_at',
            ]);
        });
    }
};
