<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('voucher_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('voucher_type', 20);                 // BPV, CPV, BRV, CRV, JV, SR, INV, BILL, CHQ
            $table->integer('fiscal_year');
            $table->integer('last_number')->default(0);
            $table->timestamps();

            $table->unique(['voucher_type', 'fiscal_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_sequences');
    }
};
