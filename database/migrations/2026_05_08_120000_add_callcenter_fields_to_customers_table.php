<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('vertical_type', 50)->nullable()->after('postal_code');
            $table->string('vertical_other', 255)->nullable()->after('vertical_type');
            $table->text('did_comments')->nullable()->after('vertical_other');
            $table->string('transferred_from', 255)->nullable()->after('did_comments');
            $table->string('verifiers_part', 255)->nullable()->after('transferred_from');
            $table->string('lead_id_timestamp', 255)->nullable()->after('verifiers_part');
            $table->string('reason', 50)->nullable()->after('lead_id_timestamp');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'vertical_type', 'vertical_other', 'did_comments',
                'transferred_from', 'verifiers_part', 'lead_id_timestamp', 'reason',
            ]);
        });
    }
};
