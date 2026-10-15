<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('cnic', 15)->nullable()->after('address');          // XXXXX-XXXXXXX-X
            $table->text('permanent_address')->nullable()->after('cnic');
            $table->text('current_address')->nullable()->after('permanent_address');
            $table->string('agent_type', 20)->nullable()->after('department'); // Closer | Verifier | Fronter
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['cnic', 'permanent_address', 'current_address', 'agent_type']);
        });
    }
};
