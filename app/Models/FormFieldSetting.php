<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class FormFieldSetting extends Model
{
    protected $fillable = [
        'form_type', 'field_key', 'label', 'placeholder', 'is_visible', 'is_required',
        'field_type', 'options', 'sort_order', 'is_core', 'section',
        'col_span', 'textarea_rows',
    ];

    protected $casts = [
        'is_visible'    => 'boolean',
        'is_required'   => 'boolean',
        'is_core'       => 'boolean',
        'options'       => 'array',
        'textarea_rows' => 'integer',
    ];
}
