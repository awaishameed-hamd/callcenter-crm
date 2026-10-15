<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountingParty extends Model
{
    protected $table = 'accounting_parties';

    protected $fillable = [
        'name', 'type', 'email', 'phone', 'address', 'tax_number', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];

    public function vouchers()
    {
        return $this->hasMany(Voucher::class, 'party_id');
    }
}
