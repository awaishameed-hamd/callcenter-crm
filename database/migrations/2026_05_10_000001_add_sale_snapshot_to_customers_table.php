<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // Frozen snapshot of client data at the moment of final approval.
            // These never change — even if the client's rate/DID/name is edited later.
            $table->string('sale_did_code', 20)->nullable()->after('client_id');
            $table->string('sale_company_name', 255)->nullable()->after('sale_did_code');
            $table->decimal('sale_rate_amount', 10, 2)->nullable()->after('sale_company_name');
            $table->string('sale_rate_type', 20)->nullable()->after('sale_rate_amount');
        });

        // Backfill existing final_approved records from their current client data
        DB::statement("
            UPDATE customers c
            INNER JOIN clients cl ON c.client_id = cl.id
            SET
                c.sale_did_code     = cl.did_code,
                c.sale_company_name = cl.company_name,
                c.sale_rate_amount  = cl.rate_of_sale_amount,
                c.sale_rate_type    = cl.rate_type
            WHERE c.status = 'final_approved'
        ");
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['sale_did_code', 'sale_company_name', 'sale_rate_amount', 'sale_rate_type']);
        });
    }
};
