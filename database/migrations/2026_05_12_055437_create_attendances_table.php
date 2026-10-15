<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');                                // PKT date of attendance
            $table->time('login_time')->nullable();              // PKT login time (HH:MM:SS)
            $table->string('login_time_formatted')->nullable();  // e.g. "5:45 PM"
            $table->enum('status', ['present', 'absent', 'weekend', 'leave'])->default('present');
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->string('edited_login_time')->nullable();     // if HR edits the time
            $table->text('notes')->nullable();
            $table->timestamps();

            // One attendance record per user per day
            $table->unique(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
