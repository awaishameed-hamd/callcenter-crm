<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    protected $table = 'exchange_rates';

    protected $fillable = ['currency', 'rate', 'rate_date'];

    protected $casts = [
        'rate'      => 'decimal:6',
        'rate_date' => 'date',
    ];

    /**
     * Get the most recent rate for a currency on or before a given date.
     */
    public static function forDate(string $currency, string $date): float
    {
        $row = static::where('currency', $currency)
            ->where('rate_date', '<=', $date)
            ->orderByDesc('rate_date')
            ->first();

        return $row ? (float) $row->rate : 1.0;
    }
}
