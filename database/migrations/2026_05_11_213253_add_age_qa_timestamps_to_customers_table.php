<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->unsignedTinyInteger('age')->nullable()->after('date_of_birth');
            $table->text('qa_comments')->nullable()->after('transferred_from');
            $table->string('submitted_at_pak', 60)->nullable()->after('lead_id_timestamp');
            $table->string('submitted_at_est', 60)->nullable()->after('submitted_at_pak');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['age', 'qa_comments', 'submitted_at_pak', 'submitted_at_est']);
        });
    }
};
