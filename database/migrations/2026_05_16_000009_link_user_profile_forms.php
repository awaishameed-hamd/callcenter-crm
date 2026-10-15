<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Profile Form and User Form both operate on the users table and extra_fields column.
 * Having two separate form_type records ('profile' and 'user') means any custom field
 * added via CRM Management → User Form never appears on My Profile, and vice versa.
 *
 * Fix: delete the duplicate 'profile' form_type records.  Profile.jsx now reads
 * from form_type='user' directly, so a single set of fields drives both forms.
 * Any new field/section added in CRM Management → "User / Profile Form" automatically
 * appears in both the New User form and the My Profile page.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::table('form_field_settings')
            ->where('form_type', 'profile')
            ->delete();
    }

    public function down(): void
    {
        // Re-seed the original profile fields on rollback
        $now = now();
        $profileFields = [
            ['field_key'=>'display_name',     'label'=>'Display Name',         'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'Display name',                'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>1],
            ['field_key'=>'first_name',       'label'=>'First Name',           'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'First name',                  'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>2],
            ['field_key'=>'mid_name',         'label'=>'Middle Name',          'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'Middle name',                 'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>3],
            ['field_key'=>'last_name',        'label'=>'Last Name',            'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'Last name',                   'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>4],
            ['field_key'=>'email',            'label'=>'Email',                'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'email@example.com',           'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>5],
            ['field_key'=>'phone',            'label'=>'Phone',                'section'=>'Personal Information', 'field_type'=>'text',     'placeholder'=>'+92 300 0000000',             'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>6],
            ['field_key'=>'date_of_birth',    'label'=>'Date of Birth',        'section'=>'Personal Information', 'field_type'=>'date',     'placeholder'=>null,                          'col_span'=>'third', 'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>7],
            ['field_key'=>'cnic',             'label'=>'CNIC Number',          'section'=>'CNIC & Address',       'field_type'=>'text',     'placeholder'=>'00000-0000000-0',             'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>10],
            ['field_key'=>'permanent_address','label'=>'Permanent Address',    'section'=>'CNIC & Address',       'field_type'=>'textarea', 'placeholder'=>'Address on CNIC',             'col_span'=>'full',  'textarea_rows'=>2, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>11],
            ['field_key'=>'current_address',  'label'=>'Current Address',      'section'=>'CNIC & Address',       'field_type'=>'textarea', 'placeholder'=>'Current residential address', 'col_span'=>'full',  'textarea_rows'=>2, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>12],
            ['field_key'=>'bank',             'label'=>'Bank Name',            'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'Bank name',                   'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>20],
            ['field_key'=>'account_title',    'label'=>'Account Title',        'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'Account holder name',         'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>21],
            ['field_key'=>'bank_account_no',  'label'=>'Account No.',          'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'Account number',              'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>22],
            ['field_key'=>'iban_no',          'label'=>'IBAN No.',             'section'=>'Banking Details',      'field_type'=>'text',     'placeholder'=>'IBAN number',                 'col_span'=>'half',  'textarea_rows'=>3, 'is_visible'=>true,  'is_required'=>false, 'is_core'=>false, 'options'=>null, 'sort_order'=>23],
        ];
        foreach ($profileFields as $f) {
            DB::table('form_field_settings')->insert(array_merge($f, [
                'form_type'  => 'profile',
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }
};
