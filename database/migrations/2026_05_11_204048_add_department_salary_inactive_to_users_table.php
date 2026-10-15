<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('department')->nullable()->after('experience');
            $table->decimal('basic_salary', 12, 2)->nullable()->after('iban_no');
            $table->decimal('punctuality_allowance', 12, 2)->nullable()->after('basic_salary');
            $table->decimal('travelling_allowance', 12, 2)->nullable()->after('punctuality_allowance');
            $table->decimal('other_allowance', 12, 2)->nullable()->after('travelling_allowance');
            $table->date('inactive_since')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'department',
                'basic_salary',
                'punctuality_allowance',
                'travelling_allowance',
                'other_allowance',
                'inactive_since',
            ]);
        });
    }
};
