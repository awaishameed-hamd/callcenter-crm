<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // 1. Add form_type column (default 'sale' keeps existing records intact)
        Schema::table('form_field_settings', function (Blueprint $table) {
            $table->string('form_type', 20)->default('sale')->after('id');
        });

        // 2. Swap unique index: field_key → (form_type, field_key)
        Schema::table('form_field_settings', function (Blueprint $table) {
            $table->dropUnique('form_field_settings_field_key_unique');
            $table->unique(['form_type', 'field_key'], 'ffs_form_type_field_key_unique');
        });

        $now = now();

        // ── Profile Form fields ───────────────────────────────────────────────
        $profileFields = [
            // Section: Personal Information
            ['field_key'=>'display_name',     'label'=>'Display Name',              'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'Display name',                'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>1],
            ['field_key'=>'first_name',       'label'=>'First Name',                'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'First name',                  'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>2],
            ['field_key'=>'mid_name',         'label'=>'Middle Name',               'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'Middle name',                 'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>3],
            ['field_key'=>'last_name',        'label'=>'Last Name',                 'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'Last name',                   'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>4],
            ['field_key'=>'email',            'label'=>'Email',                     'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'email@example.com',           'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>5],
            ['field_key'=>'phone',            'label'=>'Phone',                     'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'+92 300 0000000',             'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>6],
            ['field_key'=>'date_of_birth',    'label'=>'Date of Birth',             'section'=>'Personal Information', 'field_type'=>'date',     'placeholder'=>null,                          'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>7],
            // Section: CNIC & Address
            ['field_key'=>'cnic',             'label'=>'CNIC Number',               'section'=>'CNIC & Address',       'field_type'=>'text',     'placeholder'=>'00000-0000000-0',             'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>10],
            ['field_key'=>'permanent_address','label'=>'Permanent Address',          'section'=>'CNIC & Address',       'field_type'=>'textarea', 'placeholder'=>'Address on CNIC',             'col_span'=>'full',  'textarea_rows'=>2, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>11],
            ['field_key'=>'current_address',  'label'=>'Current Address',            'section'=>'CNIC & Address',       'field_type'=>'textarea', 'placeholder'=>'Current residential address', 'col_span'=>'full',  'textarea_rows'=>2, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>12],
            // Section: Banking Details
            ['field_key'=>'bank',             'label'=>'Bank Name',                 'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'Bank name',                   'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>20],
            ['field_key'=>'account_title',    'label'=>'Account Title',             'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'Account holder name',         'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>21],
            ['field_key'=>'bank_account_no',  'label'=>'Account No.',               'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'Account number',              'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>22],
            ['field_key'=>'iban_no',          'label'=>'IBAN No.',                  'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'IBAN number',                 'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true,  'options'=>null, 'sort_order'=>23],
        ];

        // ── Client Form fields ────────────────────────────────────────────────
        $clientFields = [
            // Section: Company Details
            ['field_key'=>'company_name',             'label'=>'Company Name',              'section'=>'Company Details', 'field_type'=>'text',       'placeholder'=>'e.g. Acme Insurance Co.', 'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>true,  'is_core'=>true, 'options'=>null,                                        'sort_order'=>1],
            ['field_key'=>'campaign',                 'label'=>'Campaign',                  'section'=>'Company Details', 'field_type'=>'select',     'placeholder'=>null,                      'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>true,  'is_core'=>true, 'options'=>json_encode(['Medicare','Final Expense','ACA']),'sort_order'=>2],
            // Section: DID & Sale Type
            ['field_key'=>'did_code',                 'label'=>'Assign DID',                'section'=>'DID & Sale Type', 'field_type'=>'select',     'placeholder'=>null,                      'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>false, 'is_core'=>true, 'options'=>null,                                        'sort_order'=>10],
            ['field_key'=>'sale_type',                'label'=>'Sale Type',                 'section'=>'DID & Sale Type', 'field_type'=>'select',     'placeholder'=>null,                      'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>true,  'is_core'=>true, 'options'=>json_encode(['CPA','CPL']),                  'sort_order'=>11],
            // Section: Rate
            ['field_key'=>'rate_type',                'label'=>'Rate Type',                 'section'=>'Rate',            'field_type'=>'select',     'placeholder'=>null,                      'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>true,  'is_core'=>true, 'options'=>json_encode(['fixed','variable']),           'sort_order'=>20],
            ['field_key'=>'rate_of_sale_amount',      'label'=>'Rate Per Sale (USD)',        'section'=>'Rate',            'field_type'=>'amount_usd', 'placeholder'=>'0.00',                    'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>false, 'is_core'=>true, 'options'=>null,                                        'sort_order'=>21],
            ['field_key'=>'opening_balance',          'label'=>'Opening Balance (USD)',      'section'=>'Rate',            'field_type'=>'amount_usd', 'placeholder'=>'0.00',                    'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>false, 'is_core'=>true, 'options'=>null,                                        'sort_order'=>22],
            // Section: Billing
            ['field_key'=>'cycle_of_day',             'label'=>'Cycle (Days)',               'section'=>'Billing',         'field_type'=>'number',     'placeholder'=>'e.g. 30',                 'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>true,  'is_core'=>true, 'options'=>null,                                        'sort_order'=>30],
            ['field_key'=>'billing_start_after_days', 'label'=>'Billing Starts After (Days)','section'=>'Billing',         'field_type'=>'number',     'placeholder'=>'e.g. 0',                  'col_span'=>'half', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>true,  'is_core'=>true, 'options'=>null,                                        'sort_order'=>31],
            // Section: Notes
            ['field_key'=>'notes',                    'label'=>'Notes',                      'section'=>'Notes',           'field_type'=>'textarea',   'placeholder'=>'Optional notes…',         'col_span'=>'full', 'textarea_rows'=>3, 'is_visible'=>true, 'is_required'=>false, 'is_core'=>true, 'options'=>null,                                        'sort_order'=>40],
        ];

        foreach ($profileFields as $f) {
            DB::table('form_field_settings')->insert(array_merge($f, [
                'form_type'  => 'profile',
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }

        foreach ($clientFields as $f) {
            DB::table('form_field_settings')->insert(array_merge($f, [
                'form_type'  => 'client',
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    public function down(): void
    {
        DB::table('form_field_settings')->whereIn('form_type', ['profile', 'client'])->delete();

        Schema::table('form_field_settings', function (Blueprint $table) {
            $table->dropUnique('ffs_form_type_field_key_unique');
            $table->dropColumn('form_type');
        });

        Schema::table('form_field_settings', function (Blueprint $table) {
            $table->unique('field_key');
        });
    }
};
