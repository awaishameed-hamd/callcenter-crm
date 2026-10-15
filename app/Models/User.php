<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'username',
        'password',
        'role',
        'display_name',
        'first_name',
        'mid_name',
        'last_name',
        'date_of_birth',
        'date_of_joining',
        'address',
        'cnic',
        'permanent_address',
        'current_address',
        'experience',
        'department',
        'agent_type',
        'manager_type',
        'email',
        'phone',
        'bank',
        'account_title',
        'bank_account_no',
        'iban_no',
        'basic_salary',
        'punctuality_allowance',
        'travelling_allowance',
        'other_allowance',
        'profile_locked',
        'created_by',
        'is_active',
        'inactive_since',
        'extra_fields',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password'               => 'hashed',
            'profile_locked'         => 'boolean',
            'is_active'              => 'boolean',
            'date_of_birth'          => 'date:Y-m-d',
            'date_of_joining'        => 'date:Y-m-d',
            'inactive_since'         => 'date:Y-m-d',
            'basic_salary'           => 'decimal:2',
            'punctuality_allowance'  => 'decimal:2',
            'travelling_allowance'   => 'decimal:2',
            'other_allowance'        => 'decimal:2',
            'extra_fields'           => 'array',
        ];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }
}
