<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    protected $fillable = [
        'invoice_number', 'client_id',
        'billing_period_start', 'billing_period_end',
        'subtotal', 'discount', 'adjustment', 'total_amount',
        'status', 'invoice_date', 'due_date', 'payment_received_date',
        'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'subtotal'     => 'decimal:2',
            'discount'     => 'decimal:2',
            'adjustment'   => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function items()
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
