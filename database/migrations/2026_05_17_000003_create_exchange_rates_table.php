<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('currency', 10);                     // USD, GBP, EUR, etc.
            $table->decimal('rate', 15, 6);                     // Rate to PKR (e.g., 278.50)
            $table->date('rate_date');
            $table->timestamps();

            $table->unique(['currency', 'rate_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_rates');
    }
};
