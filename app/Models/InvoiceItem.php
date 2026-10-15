<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InvoiceItem extends Model
{
    protected $fillable = [
        'invoice_id', 'customer_id', 'description',
        'rate', 'quantity', 'amount',
    ];

    protected function casts(): array
    {
        return [
            'rate'   => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
