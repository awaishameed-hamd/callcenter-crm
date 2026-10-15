<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Voucher extends Model
{
    protected $table = 'vouchers';

    protected $fillable = [
        'voucher_number', 'voucher_type', 'date',
        'party_id', 'payment_account_id', 'payment_method', 'reference_number',
        'currency', 'exchange_rate', 'memo', 'status',
        'linked_voucher_id', 'reversal_of_id', 'is_adjusting',
        'is_recurring', 'recurring_frequency', 'recurring_end_date',
        'created_by',
    ];

    protected $casts = [
        'date'               => 'date',
        'recurring_end_date' => 'date',
        'exchange_rate'      => 'decimal:6',
        'is_adjusting'       => 'boolean',
        'is_recurring'       => 'boolean',
    ];

    public function lines()
    {
        return $this->hasMany(VoucherLine::class, 'voucher_id');
    }

    public function party()
    {
        return $this->belongsTo(AccountingParty::class, 'party_id');
    }

    public function paymentAccount()
    {
        return $this->belongsTo(Account::class, 'payment_account_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function linkedVoucher()
    {
        return $this->belongsTo(Voucher::class, 'linked_voucher_id');
    }

    public function reversalOf()
    {
        return $this->belongsTo(Voucher::class, 'reversal_of_id');
    }

    /** Total debit of all lines */
    public function getTotalDebitAttribute(): float
    {
        return (float) $this->lines->sum('debit_pkr');
    }

    /** Total credit of all lines */
    public function getTotalCreditAttribute(): float
    {
        return (float) $this->lines->sum('credit_pkr');
    }

    /** Detect voucher type from payment account type */
    public static function detectType(Account $account, bool $isReceipt): string
    {
        $isCash = str_contains(strtolower($account->level_3), 'cash');
        if ($isReceipt) {
            return $isCash ? 'CRV' : 'BRV';
        }
        return $isCash ? 'CPV' : 'BPV';
    }
}
