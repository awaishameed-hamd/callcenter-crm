<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        Schema::create('form_field_settings', function (Blueprint $table) {
            $table->id();
            $table->string('field_key')->unique();
            $table->string('label');
            $table->boolean('is_visible')->default(true);
            $table->boolean('is_required')->default(false);
            $table->string('field_type')->default('text'); // text, select, date, number, textarea
            $table->json('options')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_core')->default(false); // core fields cannot be hidden
            $table->timestamps();
        });

        // Seed default fields
        $fields = [
            ['field_key'=>'vertical_type',    'label'=>'Vertical Type',           'is_visible'=>true,  'is_required'=>true,  'field_type'=>'select',   'options'=>json_encode(['Medicare','Final Expense','ACA','Other']), 'sort_order'=>1,  'is_core'=>true],
            ['field_key'=>'client_id',        'label'=>'Select DID',              'is_visible'=>true,  'is_required'=>true,  'field_type'=>'select',   'options'=>null, 'sort_order'=>2,  'is_core'=>true],
            ['field_key'=>'first_name',       'label'=>'First Name',              'is_visible'=>true,  'is_required'=>true,  'field_type'=>'text',     'options'=>null, 'sort_order'=>3,  'is_core'=>false],
            ['field_key'=>'mid_name',         'label'=>'Middle Name',             'is_visible'=>true,  'is_required'=>false, 'field_type'=>'text',     'options'=>null, 'sort_order'=>4,  'is_core'=>false],
            ['field_key'=>'last_name',        'label'=>'Last Name',               'is_visible'=>true,  'is_required'=>true,  'field_type'=>'text',     'options'=>null, 'sort_order'=>5,  'is_core'=>false],
            ['field_key'=>'age',              'label'=>'Age',                     'is_visible'=>true,  'is_required'=>false, 'field_type'=>'number',   'options'=>null, 'sort_order'=>6,  'is_core'=>false],
            ['field_key'=>'date_of_birth',    'label'=>'Date of Birth',           'is_visible'=>true,  'is_required'=>false, 'field_type'=>'date',     'options'=>null, 'sort_order'=>7,  'is_core'=>false],
            ['field_key'=>'phone',            'label'=>'Phone',                   'is_visible'=>true,  'is_required'=>true,  'field_type'=>'text',     'options'=>null, 'sort_order'=>8,  'is_core'=>false],
            ['field_key'=>'address',          'label'=>'Address',                 'is_visible'=>true,  'is_required'=>false, 'field_type'=>'text',     'options'=>null, 'sort_order'=>9,  'is_core'=>false],
            ['field_key'=>'city',             'label'=>'City',                    'is_visible'=>true,  'is_required'=>false, 'field_type'=>'text',     'options'=>null, 'sort_order'=>10, 'is_core'=>false],
            ['field_key'=>'state',            'label'=>'State',                   'is_visible'=>true,  'is_required'=>false, 'field_type'=>'text',     'options'=>null, 'sort_order'=>11, 'is_core'=>false],
            ['field_key'=>'postal_code',      'label'=>'Postal Code',             'is_visible'=>true,  'is_required'=>false, 'field_type'=>'text',     'options'=>null, 'sort_order'=>12, 'is_core'=>false],
            ['field_key'=>'transferred_from', 'label'=>'Transferred From',        'is_visible'=>true,  'is_required'=>false, 'field_type'=>'select',   'options'=>json_encode(['Bots','Fronter']), 'sort_order'=>13, 'is_core'=>false],
            ['field_key'=>'did_comments',     'label'=>'DID Comments',            'is_visible'=>true,  'is_required'=>false, 'field_type'=>'textarea', 'options'=>null, 'sort_order'=>14, 'is_core'=>false],
            ['field_key'=>'reason',           'label'=>'Reason of Cancellation',  'is_visible'=>true,  'is_required'=>false, 'field_type'=>'select',   'options'=>json_encode(['XFER','No LA','Ringing','Over Age','Out of State','Hangup','No medicare card']), 'sort_order'=>15, 'is_core'=>false],
        ];

        foreach ($fields as $f) {
            DB::table('form_field_settings')->insert(array_merge($f, [
                'created_at' => now(), 'updated_at' => now(),
            ]));
        }
    }

    public function down(): void {
        Schema::dropIfExists('form_field_settings');
    }
};
