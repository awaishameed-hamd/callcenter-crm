<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('form_field_settings', function (Blueprint $table) {
            $table->string('section')->nullable()->after('sort_order');
            $table->string('placeholder')->nullable()->after('label');
        });

        // Assign sections to existing fields
        $sectionMap = [
            'Vertical & DID'         => ['vertical_type', 'client_id'],
            'Personal Information'   => ['first_name', 'mid_name', 'last_name', 'age', 'date_of_birth', 'phone'],
            'Address Information'    => ['address', 'city', 'state', 'postal_code'],
            'Additional Information' => ['transferred_from', 'did_comments', 'reason'],
        ];
        foreach ($sectionMap as $section => $keys) {
            DB::table('form_field_settings')
                ->whereIn('field_key', $keys)
                ->update(['section' => $section]);
        }

        // Assign sensible placeholders
        $placeholders = [
            'first_name'   => 'First name',
            'mid_name'     => 'Middle name',
            'last_name'    => 'Last name',
            'age'          => 'Age',
            'phone'        => 'Phone number',
            'address'      => 'Full street address',
            'city'         => 'City',
            'state'        => 'State',
            'postal_code'  => 'ZIP',
            'did_comments' => 'Enter comments here...',
        ];
        foreach ($placeholders as $key => $placeholder) {
            DB::table('form_field_settings')
                ->where('field_key', $key)
                ->update(['placeholder' => $placeholder]);
        }
    }

    public function down(): void
    {
        Schema::table('form_field_settings', function (Blueprint $table) {
            $table->dropColumn(['section', 'placeholder']);
        });
    }
};
