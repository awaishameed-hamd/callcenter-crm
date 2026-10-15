<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // ── User / Profile Form ───────────────────────────────────────────────
        DB::table('form_field_settings')
            ->where('form_type', 'user')
            ->whereIn('field_key', [
                'first_name',    // identity — must always be present
                'date_of_joining', // required by backend validation (UserController)
                'basic_salary',  // primary compensation field
            ])
            ->update(['is_core' => true]);

        // ── Client Form ───────────────────────────────────────────────────────
        // did_code, sale_type, campaign, rate_type already core from migration 008.
        // Add the remaining business-critical client fields.
        DB::table('form_field_settings')
            ->where('form_type', 'client')
            ->whereIn('field_key', [
                'company_name',             // identifies the client
                'rate_of_sale_amount',      // core billing field
                'opening_balance',          // core billing field
                'cycle_of_day',             // required billing cycle
                'billing_start_after_days', // required billing field
            ])
            ->update(['is_core' => true]);

        // ── Sale Form ─────────────────────────────────────────────────────────
        DB::table('form_field_settings')
            ->where('form_type', 'sale')
            ->whereIn('field_key', [
                'first_name',        // customer identity
                'address',           // required for sales records
                'transferred_from',  // call-center workflow field
                'reason',            // Reason of Cancellation — reporting essential
            ])
            ->update(['is_core' => true]);

        // ── Label fix: "DID Comments" → "Comments" (Sale Form) ───────────────
        DB::table('form_field_settings')
            ->where('form_type', 'sale')
            ->where('field_key', 'did_comments')
            ->update(['label' => 'Comments']);
    }

    public function down(): void
    {
        // Revert core flags
        DB::table('form_field_settings')
            ->where('form_type', 'user')
            ->whereIn('field_key', ['first_name', 'date_of_joining', 'basic_salary'])
            ->update(['is_core' => false]);

        DB::table('form_field_settings')
            ->where('form_type', 'client')
            ->whereIn('field_key', [
                'company_name', 'rate_of_sale_amount', 'opening_balance',
                'cycle_of_day', 'billing_start_after_days',
            ])
            ->update(['is_core' => false]);

        DB::table('form_field_settings')
            ->where('form_type', 'sale')
            ->whereIn('field_key', ['first_name', 'address', 'transferred_from', 'reason'])
            ->update(['is_core' => false]);

        // Revert label
        DB::table('form_field_settings')
            ->where('form_type', 'sale')
            ->where('field_key', 'did_comments')
            ->update(['label' => 'DID Comments']);
    }
};
