<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Did extends Model
{
    protected $fillable = ['did_code', 'campaign', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
