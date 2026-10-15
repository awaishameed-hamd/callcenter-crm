<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'customer_code',
        'first_name',
        'mid_name',
        'last_name',
        'date_of_birth',
        'phone',
        'address',
        'city',
        'state',
        'postal_code',
        'vertical_type',
        'vertical_other',
        'did_comments',
        'age',
        'transferred_from',
        'verifiers_part',
        'lead_id_timestamp',
        'qa_comments',
        'submitted_at_pak',
        'submitted_at_est',
        'reason',
        'notes',
        'manager_note',
        'final_note',
        'status',
        'agent_id',
        'manager_id',
        'client_id',
        'approved_at',
        'disapproved_at',
        'final_approved_at',
        'final_disapproved_at',
        'sale_did_code',
        'sale_company_name',
        'sale_rate_amount',
        'sale_rate_type',
        'extra_fields',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth'        => 'date',
            'annual_income'        => 'decimal:2',
            'investment_amount'    => 'decimal:2',
            'approved_at'          => 'datetime',
            'disapproved_at'       => 'datetime',
            'final_approved_at'    => 'datetime',
            'final_disapproved_at' => 'datetime',
            'sale_rate_amount'     => 'decimal:2',
            'extra_fields'         => 'array',
        ];
    }

    public function agent()
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function invoiceItems()
    {
        return $this->hasMany(InvoiceItem::class);
    }
}
