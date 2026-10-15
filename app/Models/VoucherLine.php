<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoucherLine extends Model
{
    protected $table = 'voucher_lines';

    protected $fillable = [
        'voucher_id', 'account_id',
        'debit_pkr', 'credit_pkr',
        'foreign_debit', 'foreign_credit',
        'currency', 'exchange_rate',
        'description', 'party_id', 'is_billable', 'project',
    ];

    protected $casts = [
        'debit_pkr'     => 'decimal:2',
        'credit_pkr'    => 'decimal:2',
        'foreign_debit' => 'decimal:2',
        'foreign_credit'=> 'decimal:2',
        'exchange_rate' => 'decimal:6',
        'is_billable'   => 'boolean',
    ];

    public function voucher()
    {
        return $this->belongsTo(Voucher::class, 'voucher_id');
    }

    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }

    public function party()
    {
        return $this->belongsTo(AccountingParty::class, 'party_id');
    }
}
