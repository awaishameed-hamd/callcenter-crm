<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    protected $fillable = [
        'user_id', 'date', 'login_time', 'login_time_formatted',
        'status', 'approval_status', 'approved_by', 'approved_at',
        'edited_login_time', 'notes', 'is_late', 'late_minutes', 'manually_edited',
    ];

    protected function casts(): array
    {
        return [
            'date'        => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
