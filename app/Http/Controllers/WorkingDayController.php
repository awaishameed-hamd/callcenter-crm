<?php

namespace App\Http\Controllers;

use App\Models\AttendanceSetting;
use App\Models\WorkingDay;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkingDayController extends Controller
{
    // ── Guard: HR Manager only ────────────────────────────────────────────────
    private function requireHrManager(): void
    {
        $u = auth()->user();
        if ($u->role !== 'manager' || $u->manager_type !== 'HR Manager') {
            abort(403, 'Unauthorized.');
        }
    }

    /** Allows admin, director, or HR Manager. */
    private function requireHrAccess(): void
    {
        $u = auth()->user();
        $isHrManager       = $u->role === 'manager' && $u->manager_type === 'HR Manager';
        $isAdminOrDirector = in_array($u->role, ['admin', 'director'], true);
        if (! $isHrManager && ! $isAdminOrDirector) {
            abort(403, 'Unauthorized.');
        }
    }

    // ── GET MONTH CALENDAR ─────────────────────────────────────────────────────
    // GET /api/working-days?month=5&year=2026
    public function index(Request $request): JsonResponse
    {
        $nowPKT = now()->setTimezone('Asia/Karachi');
        $month  = (int) $request->input('month', $nowPKT->month);
        $year   = (int) $request->input('year',  $nowPKT->year);

        $records = WorkingDay::whereMonth('date', $month)
            ->whereYear('date', $year)
            ->orderBy('date')
            ->get();

        $isSetup = $records->isNotEmpty();

        // If not yet set up, return auto-generated preview (not saved)
        if (! $isSetup) {
            $records = $this->generatePreview($month, $year);
        }

        $lateMargin = (int) AttendanceSetting::get('late_margin_minutes', 15);

        return response()->json([
            'success'     => true,
            'month'       => $month,
            'year'        => $year,
            'is_setup'    => $isSetup,
            'days'        => $records,
            'late_margin' => $lateMargin,
        ]);
    }

    // ── GENERATE PREVIEW (unsaved auto-fill) ──────────────────────────────────
    private function generatePreview(int $month, int $year): \Illuminate\Support\Collection
    {
        $start   = Carbon::create($year, $month, 1);
        $end     = $start->copy()->endOfMonth();
        $current = $start->copy();
        $days    = collect();

        // Carry forward login time from the last saved working day
        $lastRecord = WorkingDay::where('date', '<', $start->toDateString())
            ->whereNotNull('login_time')
            ->where('status', 'working_day')
            ->orderByDesc('date')
            ->first();

        $defaultLoginTime      = $lastRecord ? $lastRecord->login_time           : '19:10:00';
        $defaultLoginFormatted = $lastRecord ? $lastRecord->login_time_formatted  : '7:10 PM';

        while ($current <= $end) {
            $isWeekend = in_array($current->dayOfWeek, [0, 6], true);
            $days->push([
                'date'                 => $current->toDateString(),
                'day_name'             => $current->format('l'),
                'status'               => $isWeekend ? 'weekend' : 'working_day',
                'leave_reason'         => null,
                'login_time'           => $isWeekend ? null : $defaultLoginTime,
                'login_time_formatted' => $isWeekend ? null : $defaultLoginFormatted,
            ]);
            $current->addDay();
        }

        return $days;
    }

    // ── SETUP / SAVE FULL MONTH ────────────────────────────────────────────────
    // POST /api/working-days/setup
    public function setup(Request $request): JsonResponse
    {
        $this->requireHrAccess();

        $request->validate([
            'month'              => 'required|integer|min:1|max:12',
            'year'               => 'required|integer|min:2024',
            'days'               => 'required|array',
            'days.*.date'        => 'required|date',
            'days.*.status'      => 'required|in:working_day,weekend,leave',
            'days.*.leave_reason'=> 'nullable|string|max:255',
            'days.*.login_time'  => 'nullable|string',
        ]);

        $userId = auth()->id();

        foreach ($request->days as $day) {
            if ($day['status'] === 'leave' && empty($day['leave_reason'])) {
                return response()->json([
                    'success' => false,
                    'message' => "Leave reason is required for date {$day['date']}.",
                ], 422);
            }

            $loginTime      = null;
            $loginFormatted = null;

            if (! empty($day['login_time']) && $day['status'] === 'working_day') {
                try {
                    $parsed         = Carbon::createFromFormat('g:i A', trim($day['login_time']));
                    $loginTime      = $parsed->format('H:i:s');
                    $loginFormatted = $parsed->format('g:i A');
                } catch (\Exception $e) {
                    // keep null if parse fails
                }
            }

            WorkingDay::updateOrCreate(
                ['date' => $day['date']],
                [
                    'month'                => $request->month,
                    'year'                 => $request->year,
                    'day_name'             => Carbon::parse($day['date'])->format('l'),
                    'status'               => $day['status'],
                    'leave_reason'         => $day['status'] === 'leave' ? $day['leave_reason'] : null,
                    'login_time'           => $loginTime,
                    'login_time_formatted' => $loginFormatted,
                    'created_by'           => $userId,
                    'updated_by'           => $userId,
                ]
            );
        }

        return response()->json(['success' => true, 'message' => 'Working days saved successfully.']);
    }

    // ── UPDATE SINGLE DAY STATUS ───────────────────────────────────────────────
    // PATCH /api/working-days/{date}   (date = YYYY-MM-DD)
    public function updateDay(Request $request, string $date): JsonResponse
    {
        $this->requireHrAccess();

        $request->validate([
            'status'       => 'required|in:working_day,weekend,leave',
            'leave_reason' => 'nullable|string|max:255',
        ]);

        if ($request->status === 'leave' && empty($request->leave_reason)) {
            return response()->json(['success' => false, 'message' => 'Leave reason is required.'], 422);
        }

        WorkingDay::where('date', $date)->update([
            'status'       => $request->status,
            'leave_reason' => $request->status === 'leave' ? $request->leave_reason : null,
            'updated_by'   => auth()->id(),
        ]);

        return response()->json(['success' => true, 'message' => 'Day updated.']);
    }

    // ── UPDATE LOGIN TIME (carries forward to all future working days) ─────────
    // PATCH /api/working-days/{date}/login-time
    public function updateLoginTime(Request $request, string $date): JsonResponse
    {
        $this->requireHrAccess();

        $request->validate(['login_time' => 'required|string']);

        // Only yesterday, today, tomorrow (PKT) are editable
        $nowPKT    = now()->setTimezone('Asia/Karachi')->toDateString();
        $yesterday = now()->setTimezone('Asia/Karachi')->subDay()->toDateString();
        $tomorrow  = now()->setTimezone('Asia/Karachi')->addDay()->toDateString();

        if (! in_array($date, [$yesterday, $nowPKT, $tomorrow])) {
            return response()->json([
                'success' => false,
                'message' => 'Login time can only be edited for yesterday, today, and tomorrow.',
            ], 422);
        }

        try {
            $parsed         = Carbon::createFromFormat('g:i A', trim($request->login_time));
            $timeH          = $parsed->format('H:i:s');
            $timeFormatted  = $parsed->format('g:i A');
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Invalid time format. Use h:mm AM/PM.'], 422);
        }

        // Update this date
        WorkingDay::where('date', $date)->update([
            'login_time'           => $timeH,
            'login_time_formatted' => $timeFormatted,
            'updated_by'           => auth()->id(),
        ]);

        // Carry forward to all future working days
        WorkingDay::where('date', '>', $date)
            ->where('status', 'working_day')
            ->update([
                'login_time'           => $timeH,
                'login_time_formatted' => $timeFormatted,
                'updated_by'           => auth()->id(),
            ]);

        return response()->json([
            'success' => true,
            'message' => "Login time updated to {$timeFormatted} and carried forward to all future working days.",
        ]);
    }

    // ── GET SETTINGS ──────────────────────────────────────────────────────────
    // GET /api/working-days/settings
    public function getSettings(): JsonResponse
    {
        return response()->json([
            'success'  => true,
            'settings' => AttendanceSetting::all(),
        ]);
    }

    // ── UPDATE SETTING ─────────────────────────────────────────────────────────
    // PATCH /api/working-days/settings/{key}
    public function updateSetting(Request $request, string $key): JsonResponse
    {
        $this->requireHrAccess();

        $request->validate(['value' => 'required']);

        AttendanceSetting::where('key', $key)->update([
            'value'      => $request->value,
            'updated_by' => auth()->id(),
        ]);

        return response()->json(['success' => true, 'message' => 'Setting updated.']);
    }
}
