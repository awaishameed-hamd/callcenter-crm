<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkingDay extends Model
{
    protected $fillable = [
        'month', 'year', 'date', 'day_name',
        'status', 'leave_reason',
        'login_time', 'login_time_formatted',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d'];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
