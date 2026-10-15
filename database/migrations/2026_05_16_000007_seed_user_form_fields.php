<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $now = now();

        $fields = [
            // ── Personal Information ──────────────────────────────────────────
            ['field_key'=>'first_name',            'label'=>'First Name',                'section'=>'Personal Information', 'field_type'=>'text',       'placeholder'=>'First',                        'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>true,  'is_core'=>true, 'options'=>null, 'sort_order'=>1],
            ['field_key'=>'mid_name',              'label'=>'Middle Name',               'section'=>'Personal Information', 'field_type'=>'text',       'placeholder'=>'Middle',                       'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>2],
            ['field_key'=>'last_name',             'label'=>'Last Name',                 'section'=>'Personal Information', 'field_type'=>'text',       'placeholder'=>'Last',                         'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>true,  'is_core'=>true, 'options'=>null, 'sort_order'=>3],
            ['field_key'=>'email',                 'label'=>'Email',                     'section'=>'Personal Information', 'field_type'=>'text',       'placeholder'=>'email@example.com',            'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>4],
            ['field_key'=>'phone',                 'label'=>'Phone',                     'section'=>'Personal Information', 'field_type'=>'text',       'placeholder'=>'+92 300 0000000',              'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>5],
            ['field_key'=>'date_of_birth',         'label'=>'Date of Birth',             'section'=>'Personal Information', 'field_type'=>'date',       'placeholder'=>null,                           'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>6],
            ['field_key'=>'date_of_joining',       'label'=>'Date of Joining',           'section'=>'Personal Information', 'field_type'=>'date',       'placeholder'=>null,                           'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>true,  'is_core'=>true, 'options'=>null, 'sort_order'=>7],
            ['field_key'=>'department',            'label'=>'Department',                'section'=>'Personal Information', 'field_type'=>'select',     'placeholder'=>null,                           'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>json_encode(['Medicare','Final Expense','ACA','Management']), 'sort_order'=>8],
            ['field_key'=>'experience',            'label'=>'Experience',                'section'=>'Personal Information', 'field_type'=>'text',       'placeholder'=>'e.g. 3 years in sales',       'col_span'=>'full',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>9],
            // ── CNIC & Address ────────────────────────────────────────────────
            ['field_key'=>'cnic',                  'label'=>'CNIC Number',               'section'=>'CNIC & Address',       'field_type'=>'text',       'placeholder'=>'00000-0000000-0',              'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>10],
            ['field_key'=>'permanent_address',     'label'=>'Permanent Address',          'section'=>'CNIC & Address',       'field_type'=>'textarea',   'placeholder'=>'Address on CNIC',             'col_span'=>'full',  'textarea_rows'=>2, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>11],
            ['field_key'=>'current_address',       'label'=>'Current Address',            'section'=>'CNIC & Address',       'field_type'=>'textarea',   'placeholder'=>'Current residential address', 'col_span'=>'full',  'textarea_rows'=>2, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>12],
            // ── Salary (PKR) ──────────────────────────────────────────────────
            ['field_key'=>'basic_salary',          'label'=>'Basic Salary',              'section'=>'Salary (PKR)',         'field_type'=>'amount_pkr', 'placeholder'=>'0.00',                        'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>20],
            ['field_key'=>'punctuality_allowance', 'label'=>'Punctuality Allowance',     'section'=>'Salary (PKR)',         'field_type'=>'amount_pkr', 'placeholder'=>'0.00',                        'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>21],
            ['field_key'=>'travelling_allowance',  'label'=>'Travelling Allowance',      'section'=>'Salary (PKR)',         'field_type'=>'amount_pkr', 'placeholder'=>'0.00',                        'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>22],
            ['field_key'=>'other_allowance',       'label'=>'Other Allowance',           'section'=>'Salary (PKR)',         'field_type'=>'amount_pkr', 'placeholder'=>'0.00',                        'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>23],
            // ── Banking Details ───────────────────────────────────────────────
            ['field_key'=>'bank',                  'label'=>'Bank',                      'section'=>'Banking Details',      'field_type'=>'text',       'placeholder'=>'Bank name',                   'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>30],
            ['field_key'=>'account_title',         'label'=>'Account Title',             'section'=>'Banking Details',      'field_type'=>'text',       'placeholder'=>'Account holder name',         'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>31],
            ['field_key'=>'bank_account_no',       'label'=>'Account No.',               'section'=>'Banking Details',      'field_type'=>'text',       'placeholder'=>'Account number',              'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>32],
            ['field_key'=>'iban_no',               'label'=>'IBAN No.',                  'section'=>'Banking Details',      'field_type'=>'text',       'placeholder'=>'IBAN number',                 'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>true, 'options'=>null, 'sort_order'=>33],
        ];

        foreach ($fields as $f) {
            DB::table('form_field_settings')->insert(array_merge($f, [
                'form_type'  => 'user',
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    public function down(): void
    {
        DB::table('form_field_settings')->where('form_type', 'user')->delete();
    }
};
