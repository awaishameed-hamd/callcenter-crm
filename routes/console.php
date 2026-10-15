<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ── Attendance: auto-mark absent at midnight PKT ──────────────────────────────
// Runs at 00:01 AM PKT every day.
// Marks absent for any active manager/agent who has no attendance record
// for the day that just ended (5 PM → midnight window).
Schedule::command('attendance:mark-absent')
    ->dailyAt('00:01')
    ->timezone('Asia/Karachi');
