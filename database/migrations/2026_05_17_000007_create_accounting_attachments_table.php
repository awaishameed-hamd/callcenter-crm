<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('accounting_attachments', function (Blueprint $table) {
            $table->id();
            $table->string('attachable_type', 50);              // 'voucher', 'bill', etc.
            $table->unsignedBigInteger('attachable_id');
            $table->string('filename');
            $table->string('original_name');
            $table->string('file_path');
            $table->integer('file_size')->default(0);           // bytes
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('uploaded_by');
            $table->timestamps();

            $table->index(['attachable_type', 'attachable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_attachments');
    }
};
