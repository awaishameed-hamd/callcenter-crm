<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // ── Profile Form ─────────────────────────────────────────────────────
        // None of the profile fields have special hardcoded frontend logic
        // (no inter-field dependencies like Sale Form's vertical → DID cascade)
        // → all non-core so admin can delete/manage them freely
        DB::table('form_field_settings')
            ->where('form_type', 'profile')
            ->update(['is_core' => false]);

        // ── Client Form ──────────────────────────────────────────────────────
        // First mark everything deletable, then lock the 4 fields that drive
        // hardcoded frontend logic (DID cascade, CPA/CPL toggle, rate toggle)
        DB::table('form_field_settings')
            ->where('form_type', 'client')
            ->update(['is_core' => false]);

        DB::table('form_field_settings')
            ->where('form_type', 'client')
            ->whereIn('field_key', [
                'campaign',    // drives the DID dropdown filter
                'did_code',    // special DID loader (API call on campaign change)
                'sale_type',   // CPA / CPL selection drives rate display
                'rate_type',   // fixed / variable toggle in rate section
            ])
            ->update(['is_core' => true]);

        // ── User Form ────────────────────────────────────────────────────────
        // All user fields are plain data fields (department, salary, banking…)
        // No special inter-field logic → all non-core
        DB::table('form_field_settings')
            ->where('form_type', 'user')
            ->update(['is_core' => false]);
    }

    public function down(): void
    {
        // Restore original state: all profile/client/user fields were is_core = true
        DB::table('form_field_settings')
            ->whereIn('form_type', ['profile', 'client', 'user'])
            ->update(['is_core' => true]);
    }
};
