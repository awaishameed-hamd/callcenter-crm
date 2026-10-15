<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leaves', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('leave_type');      // sick, casual, annual, exam, other
            $table->date('from_date');
            $table->date('to_date');
            $table->unsignedInteger('days')->default(1);
            $table->text('reason');
            $table->string('status')->default('pending'); // pending, approved, rejected
            $table->unsignedBigInteger('reviewed_by_id')->nullable();
            $table->foreign('reviewed_by_id')->references('id')->on('users')->onDelete('set null');
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leaves');
    }
};
