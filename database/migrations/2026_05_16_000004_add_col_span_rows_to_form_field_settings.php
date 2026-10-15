<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('form_field_settings', function (Blueprint $table) {
            // col_span: 'full' | 'two_thirds' | 'half' | 'third'
            $table->string('col_span', 20)->default('third')->after('section');
            // textarea rows (only meaningful for textarea type)
            $table->unsignedTinyInteger('textarea_rows')->default(3)->after('col_span');
        });

        // Full-width fields
        DB::table('form_field_settings')
            ->whereIn('field_key', ['address', 'did_comments'])
            ->update(['col_span' => 'full']);

        // Half-width fields
        DB::table('form_field_settings')
            ->whereIn('field_key', ['transferred_from', 'reason', 'vertical_type', 'client_id'])
            ->update(['col_span' => 'half']);

        // Textarea rows
        DB::table('form_field_settings')
            ->where('field_key', 'did_comments')
            ->update(['textarea_rows' => 4]);
    }

    public function down(): void
    {
        Schema::table('form_field_settings', function (Blueprint $table) {
            $table->dropColumn(['col_span', 'textarea_rows']);
        });
    }
};
