<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    protected $table = 'accounts';

    protected $fillable = [
        'account_code', 'account_name',
        'level_1', 'level_2', 'level_3', 'level_4', 'level_5',
        'account_type', 'normal_balance', 'currency',
        'is_posting', 'is_active', 'parent_id', 'description',
    ];

    protected $casts = [
        'is_posting' => 'boolean',
        'is_active'  => 'boolean',
    ];

    /** L2 values that require L4 (Asset Class) */
    public const L4_REQUIRED = [
        'Property, Plant & Equipment',
        'Intangible Assets',
        'Right of Use Assets',
        'Lease Liability',
        'Concession Assets',
    ];

    public function parent()
    {
        return $this->belongsTo(Account::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Account::class, 'parent_id');
    }

    public function voucherLines()
    {
        return $this->hasMany(VoucherLine::class, 'account_id');
    }

    /**
     * Live balance in PKR.
     * Debit-normal accounts return positive when net debit.
     * Credit-normal accounts return positive when net credit.
     */
    public function getBalanceAttribute(): float
    {
        $lines = $this->voucherLines()
            ->whereHas('voucher', fn ($q) => $q->where('status', 'posted'))
            ->selectRaw('SUM(debit_pkr) as total_debit, SUM(credit_pkr) as total_credit')
            ->first();

        $debit  = (float) ($lines->total_debit  ?? 0);
        $credit = (float) ($lines->total_credit ?? 0);

        return $this->normal_balance === 'debit'
            ? $debit - $credit
            : $credit - $debit;
    }

    /** Is L4 required for this account's L2 classification? */
    public function requiresL4(): bool
    {
        return in_array($this->level_2, self::L4_REQUIRED, true);
    }
}
