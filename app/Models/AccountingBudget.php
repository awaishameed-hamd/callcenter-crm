<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountingBudget extends Model
{
    protected $table = 'accounting_budgets';

    protected $fillable = ['account_id', 'fiscal_year', 'month', 'amount'];

    protected $casts = ['amount' => 'decimal:2'];

    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
