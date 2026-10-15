<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class VoucherSequence extends Model
{
    protected $table = 'voucher_sequences';

    protected $fillable = ['voucher_type', 'fiscal_year', 'last_number'];

    /**
     * Atomically increment and return the next voucher number string.
     * Uses row-level locking to prevent duplicates under concurrent requests.
     */
    public static function nextNumber(string $type, int $year): string
    {
        return DB::transaction(function () use ($type, $year) {
            $seq = static::lockForUpdate()->firstOrCreate(
                ['voucher_type' => $type, 'fiscal_year' => $year],
                ['last_number' => 0]
            );
            $seq->increment('last_number');
            $seq->refresh();

            $n = $seq->last_number;

            return match ($type) {
                'JV'   => sprintf('JV%05d', $n),
                'BPV'  => sprintf('BPV-%d-%04d', $year, $n),
                'CPV'  => sprintf('CPV-%d-%04d', $year, $n),
                'BRV'  => sprintf('BRV-%d-%04d', $year, $n),
                'CRV'  => sprintf('CRV-%d-%04d', $year, $n),
                'SR'   => sprintf('SR-%d-%04d', $year, $n),
                'INV'  => sprintf('INV-%d-%04d', $year, $n),
                'BILL' => sprintf('BILL-%d-%04d', $year, $n),
                'CHQ'  => sprintf('CHQ-%d-%04d', $year, $n),
                default => sprintf('%s-%d-%04d', $type, $year, $n),
            };
        });
    }
}
