<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            // Drop the old unique index on did_code — DIDs are now reusable across clients
            $table->dropUnique(['did_code']);
            // did_code now stores the assigned DID (nullable, not unique so it can be reused after client deactivated)
            $table->string('did_code', 10)->nullable()->change();
            // display_name no longer needed — company_name IS the real name
            // campaign and rate_type were already added in the previous migration
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->unique('did_code');
        });
    }
};
