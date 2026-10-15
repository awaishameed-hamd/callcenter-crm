<?php

namespace App\Console\Commands;

use App\Models\Attendance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;

class MarkAbsentAttendance extends Command
{
    protected $signature   = 'attendance:mark-absent';
    protected $description = 'Auto-mark absent for employees who did not log in between 5 PM and midnight PKT';

    public function handle(): int
    {
        $nowPKT     = Carbon::now('Asia/Karachi');
        $targetDate = $nowPKT->copy()->subDay(); // The day that just ended

        // Skip Saturdays (6) and Sundays (7) — no attendance on weekends
        $dayOfWeek = (int) $targetDate->format('N'); // 1=Mon … 7=Sun
        if ($dayOfWeek >= 6) {
            $this->info("Weekend — skipping auto-absent for {$targetDate->toDateString()}.");
            return 0;
        }

        $dateStr = $targetDate->toDateString();

        // All active managers and agents
        $users = User::whereIn('role', ['manager', 'agent'])
            ->where('is_active', true)
            ->get();

        $marked = 0;

        foreach ($users as $user) {
            // Already has a record for this date — skip
            $exists = Attendance::where('user_id', $user->id)
                ->where('date', $dateStr)
                ->exists();

            if ($exists) {
                continue;
            }

            // Before joining date — skip (not their working day yet)
            if ($user->date_of_joining && $dateStr < $user->date_of_joining->toDateString()) {
                continue;
            }

            Attendance::create([
                'user_id'              => $user->id,
                'date'                 => $dateStr,
                'login_time'           => null,
                'login_time_formatted' => null,
                'status'               => 'absent',
                'approval_status'      => 'rejected',
            ]);

            $marked++;
        }

        $this->info("Auto-absent complete: {$marked} employee(s) marked absent for {$dateStr}.");

        return 0;
    }
}
