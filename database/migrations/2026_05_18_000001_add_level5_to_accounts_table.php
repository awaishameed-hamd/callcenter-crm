<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            // level_4 = User's L3: Cost, Accumulated Depreciation, Cash (optional for some)
            // level_5 = User's L4: Computer & IT Equipment, Building, Petty Cash (optional)
            $table->string('level_5')->nullable()->after('level_4');
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('level_5');
        });
    }
};
