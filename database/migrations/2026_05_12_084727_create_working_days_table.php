<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('working_days', function (Blueprint $table) {
            $table->id();
            $table->integer('month');                           // 1–12
            $table->integer('year');                            // e.g. 2026
            $table->date('date');                               // exact date e.g. 2026-05-01
            $table->string('day_name');                         // Monday, Tuesday etc.
            $table->enum('status', [
                'working_day', 'weekend', 'leave',
            ])->default('working_day');
            $table->string('leave_reason')->nullable();         // required if status = leave
            $table->time('login_time')->nullable();             // e.g. 19:10:00 (7:10 PM PKT)
            $table->string('login_time_formatted')->nullable(); // e.g. "7:10 PM"
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['date']); // one record per calendar date
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('working_days');
    }
};
