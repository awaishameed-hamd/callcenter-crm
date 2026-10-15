<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    protected $fillable = [
        'did_code',
        'sale_type',
        'campaign',
        'company_name',
        'display_name',
        'rate_of_sale_amount',
        'opening_balance',
        'rate_type',
        'cycle_of_day',
        'billing_start_after_days',
        'notes',
        'is_active',
        'extra_fields',
        'billing_cycle_days',
        'billing_start_after',
    ];

    protected function casts(): array
    {
        return [
            'rate_of_sale_amount' => 'decimal:2',
            'opening_balance'     => 'decimal:2',
            'is_active'           => 'boolean',
            'extra_fields'        => 'array',
        ];
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }
}
