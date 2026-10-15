<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    // ── Helpers ────────────────────────────────────────────────────────────────

    private function requireRole(array $roles): void
    {
        if (! in_array(auth()->user()->role, $roles, true)) {
            abort(403, 'Unauthorized.');
        }
    }

    private function requireHrManager(): void
    {
        $user = auth()->user();
        if ($user->role !== 'manager' || $user->manager_type !== 'HR Manager') {
            abort(403, 'Unauthorized.');
        }
    }

    /** Allows admin, director, or HR Manager. */
    private function requireHrAccess(): void
    {
        $user = auth()->user();
        $isHrManager      = $user->role === 'manager' && $user->manager_type === 'HR Manager';
        $isAdminOrDirector = in_array($user->role, ['admin', 'director'], true);
        if (! $isHrManager && ! $isAdminOrDirector) {
            abort(403, 'Unauthorized.');
        }
    }

    private function todayPKT(): string
    {
        return now()->setTimezone('Asia/Karachi')->toDateString();
    }

    // ── MY ATTENDANCE ──────────────────────────────────────────────────────────
    // GET /api/attendance/my?month=5&year=2026
    public function myAttendance(Request $request): JsonResponse
    {
        $this->requireRole(['manager', 'agent']);

        $nowPKT      = now()->setTimezone('Asia/Karachi');
        $month       = (int) $request->input('month', $nowPKT->month);
        $year        = (int) $request->input('year',  $nowPKT->year);
        $user        = auth()->user();
        $joiningDate = $user->date_of_joining;

        $moduleStart = Carbon::create(2026, 5, 1)->startOfMonth();
        $requested   = Carbon::create($year, $month, 1)->startOfMonth();

        if ($requested->lt($moduleStart)) {
            return response()->json(['success' => false, 'message' => 'Attendance data is only available from May 2026.'], 422);
        }

        if ($joiningDate) {
            $joiningMonth = $joiningDate->copy()->startOfMonth();
            if ($requested->lt($joiningMonth)) {
                return response()->json(['success' => false, 'message' => 'This month is before your joining date.'], 422);
            }
        }

        $startDate = Carbon::create($year, $month, 1);
        $endDate   = $startDate->copy()->endOfMonth();
        $todayPKT  = $nowPKT->toDateString();

        $records = Attendance::where('user_id', $user->id)
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->get()
            ->keyBy(fn ($r) => $r->date->format('Y-m-d'));

        $workingDays = \App\Models\WorkingDay::whereMonth('date', $month)
            ->whereYear('date', $year)
            ->get()
            ->keyBy(fn ($wd) => $wd->date->format('Y-m-d'));

        $calendar = [];
        $current  = $startDate->copy();

        while ($current <= $endDate) {
            $dateStr       = $current->format('Y-m-d');
            $beforeJoining = $joiningDate && $dateStr < $joiningDate->toDateString();

            if ($beforeJoining) {
                $calendar[] = [
                    'date'            => $dateStr,
                    'day_name'        => $current->format('l'),
                    'day_short'       => $current->format('D, M j'),
                    'status'          => 'not_joined',
                    'login_time'      => null,
                    'approval_status' => null,
                    'attendance_id'   => null,
                    'is_late'         => false,
                    'late_minutes'    => null,
                    'leave_reason'    => null,
                ];
            } else {
                $wd         = $workingDays[$dateStr] ?? null;
                $isLeaveDay = $wd && $wd->status === 'leave';
                $isWeekend  = $wd
                    ? $wd->status === 'weekend'
                    : in_array($current->dayOfWeek, [0, 6], true);

                if ($isLeaveDay) {
                    $calendar[] = [
                        'date'            => $dateStr,
                        'day_name'        => $current->format('l'),
                        'day_short'       => $current->format('D, M j'),
                        'status'          => 'leave',
                        'login_time'      => null,
                        'approval_status' => null,
                        'attendance_id'   => null,
                        'is_late'         => false,
                        'late_minutes'    => null,
                        'leave_reason'    => $wd->leave_reason,
                    ];
                } elseif ($isWeekend) {
                    $calendar[] = [
                        'date'            => $dateStr,
                        'day_name'        => $current->format('l'),
                        'day_short'       => $current->format('D, M j'),
                        'status'          => 'weekend',
                        'login_time'      => null,
                        'approval_status' => null,
                        'attendance_id'   => null,
                        'is_late'         => false,
                        'late_minutes'    => null,
                        'leave_reason'    => null,
                    ];
                } elseif (isset($records[$dateStr])) {
                    $rec = $records[$dateStr];
                    $calendar[] = [
                        'date'            => $dateStr,
                        'day_name'        => $rec->date->format('l'),
                        'day_short'       => $rec->date->format('D, M j'),
                        'status'          => $rec->status,
                        'login_time'      => $rec->edited_login_time ?? $rec->login_time_formatted,
                        'approval_status' => $rec->approval_status,
                        'attendance_id'   => $rec->id,
                        'is_late'         => (bool) $rec->is_late,
                        'late_minutes'    => $rec->late_minutes,
                        'leave_reason'    => null,
                        'manually_edited' => (bool) $rec->manually_edited,
                    ];
                } else {
                    $calendar[] = [
                        'date'            => $dateStr,
                        'day_name'        => $current->format('l'),
                        'day_short'       => $current->format('D, M j'),
                        'status'          => $dateStr < $todayPKT ? 'absent' : 'upcoming',
                        'login_time'      => null,
                        'approval_status' => null,
                        'attendance_id'   => null,
                        'is_late'         => false,
                        'late_minutes'    => null,
                        'leave_reason'    => null,
                    ];
                }
            }

            $current->addDay();
        }

        $col     = collect($calendar);
        $summary = [
            'present'      => $col->where('status', 'present')->count(),
            'late'         => $col->where('status', 'late')->count(),
            'absent'       => $col->where('status', 'absent')->count(),
            'leave'        => $col->where('status', 'leave')->count(),
            'weekend'      => $col->where('status', 'weekend')->count(),
            'working_days' => $col->whereNotIn('status', ['weekend', 'upcoming', 'not_joined'])->count(),
        ];

        return response()->json([
            'success'      => true,
            'month'        => $month,
            'year'         => $year,
            'joining_date' => $joiningDate?->toDateString(),
            'calendar'     => $calendar,
            'summary'      => $summary,
        ]);
    }

    // ── ATTENDANCE REPORT ──────────────────────────────────────────────────────
    // GET /api/attendance/report?month=5&year=2026&search=&role=&department=
    public function report(Request $request): JsonResponse
    {
        $this->requireHrAccess();

        $nowPKT = now()->setTimezone('Asia/Karachi');
        $month  = (int) $request->input('month', $nowPKT->month);
        $year   = (int) $request->input('year',  $nowPKT->year);
        $search = $request->input('search');
        $role   = $request->input('role');
        $dept   = $request->input('department');

        $usersQuery = User::whereIn('role', ['manager', 'agent'])->where('is_active', true)
            ->where(fn ($q) => $q->where('role', 'agent')->orWhere('manager_type', '!=', 'Accountant'));

        if ($search) {
            $usersQuery->where(function ($q) use ($search) {
                $q->where('display_name', 'like', "%$search%")
                  ->orWhere('username', 'like', "%$search%");
            });
        }
        if ($role) $usersQuery->where('role', $role);
        if ($dept) $usersQuery->where('department', $dept);

        $usersQuery->orderByRaw("FIELD(role,'manager','agent')")->orderBy('username');
        $users = $usersQuery->get();

        $daysInMonth = Carbon::create($year, $month, 1)->daysInMonth;
        $todayPKT    = $nowPKT->toDateString();

        // Load working_days for the month for proper leave/weekend detection
        $workingDaysMap = \App\Models\WorkingDay::whereMonth('date', $month)
            ->whereYear('date', $year)
            ->get()
            ->keyBy(fn ($wd) => (int) $wd->date->format('j'));

        $report = [];

        foreach ($users as $user) {
            $records = Attendance::where('user_id', $user->id)
                ->whereYear('date', $year)
                ->whereMonth('date', $month)
                ->get()
                ->keyBy(fn ($r) => (int) $r->date->format('j'));

            $joiningDate = $user->date_of_joining; // Carbon date or null

            $days = [];
            for ($d = 1; $d <= $daysInMonth; $d++) {
                $date    = Carbon::create($year, $month, $d);
                $dateStr = $date->toDateString();
                $wd      = $workingDaysMap[$d] ?? null;

                // Before joining date → show as not-yet-joined, not absent
                $beforeJoining = $joiningDate && $dateStr < $joiningDate->toDateString();

                if ($beforeJoining) {
                    $days[$d] = [
                        'status'          => 'Not Joined',
                        'login_time'      => null,
                        'attendance_id'   => null,
                        'manually_edited' => false,
                        'is_late'         => false,
                        'late_minutes'    => null,
                    ];
                    continue;
                }

                $isWdLeave   = $wd && $wd->status === 'leave';
                $isWdWeekend = $wd
                    ? $wd->status === 'weekend'
                    : in_array($date->dayOfWeek, [0, 6], true);

                if ($isWdLeave) {
                    $days[$d] = [
                        'status'          => 'Leave',
                        'login_time'      => null,
                        'attendance_id'   => null,
                        'manually_edited' => false,
                        'is_late'         => false,
                        'late_minutes'    => null,
                    ];
                } elseif ($isWdWeekend) {
                    $days[$d] = [
                        'status'          => 'Week-End',
                        'login_time'      => null,
                        'attendance_id'   => null,
                        'manually_edited' => false,
                        'is_late'         => false,
                        'late_minutes'    => null,
                    ];
                } elseif (isset($records[$d])) {
                    $rec      = $records[$d];
                    $days[$d] = [
                        'status'          => ucfirst($rec->status),
                        'login_time'      => $rec->edited_login_time ?? $rec->login_time_formatted,
                        'attendance_id'   => $rec->id,
                        'manually_edited' => (bool) $rec->manually_edited,
                        'is_late'         => (bool) $rec->is_late,
                        'late_minutes'    => $rec->late_minutes,
                    ];
                } else {
                    $days[$d] = [
                        'status'          => $dateStr < $todayPKT ? 'Absent' : '—',
                        'login_time'      => null,
                        'attendance_id'   => null,
                        'manually_edited' => false,
                        'is_late'         => false,
                        'late_minutes'    => null,
                    ];
                }
            }

            $dayCollection  = collect($days);
            // Late = still present (person showed up, just late) — include both statuses
            $totalPresent   = $records->whereIn('status', ['present', 'late'])->count();
            $totalAbsent    = $dayCollection->filter(fn ($v) => $v['status'] === 'Absent')->count();
            $totalLeave     = $dayCollection->filter(fn ($v) => $v['status'] === 'Leave')->count();
            $totalWeekend   = $dayCollection->filter(fn ($v) => $v['status'] === 'Week-End')->count();
            $totalNotJoined = $dayCollection->filter(fn ($v) => $v['status'] === 'Not Joined')->count();

            $report[] = [
                'user_id'           => $user->id,
                'username'          => $user->username,
                'display_name'      => $user->display_name,
                'role'              => $user->role,
                'manager_type'      => $user->manager_type,
                'agent_type'        => $user->agent_type,
                'department'        => $user->department,
                'date_of_joining'   => $user->date_of_joining?->format('Y-m-d'),
                'days'              => $days,
                'total_present'     => $totalPresent,
                'total_late'        => $records->where('is_late', true)->count(),
                'total_absent'      => $totalAbsent,
                'total_leave'       => $totalLeave,
                'total_weekend'     => $totalWeekend,
                'total_not_joined'  => $totalNotJoined,
            ];
        }

        return response()->json([
            'success'       => true,
            'month'         => $month,
            'year'          => $year,
            'days_in_month' => $daysInMonth,
            'report'        => $report,
        ]);
    }

    // ── EXPORT REPORT AS CSV ───────────────────────────────────────────────────
    // GET /api/attendance/report/export?month=5&year=2026
    public function exportReport(Request $request): JsonResponse
    {
        $this->requireHrAccess();

        $nowPKT      = now()->setTimezone('Asia/Karachi');
        $month       = (int) $request->input('month', $nowPKT->month);
        $year        = (int) $request->input('year',  $nowPKT->year);
        $daysInMonth = Carbon::create($year, $month, 1)->daysInMonth;
        $todayPKT    = $nowPKT->toDateString();
        $monthName   = Carbon::create($year, $month, 1)->format('F');

        $users = User::whereIn('role', ['manager', 'agent'])
            ->where('is_active', true)
            ->where(fn ($q) => $q->where('role', 'agent')->orWhere('manager_type', '!=', 'Accountant'))
            ->orderByRaw("FIELD(role,'manager','agent')")->orderBy('username')
            ->get();

        $dayNames = [];
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $dayNames[] = Carbon::create($year, $month, $d)->format('D');
        }

        $rows   = [];
        $rows[] = ["Month: $monthName", "Year: $year", "Working Days: $daysInMonth", '', ''];
        $rows[] = [];

        $header = ['S.No', 'User ID', 'Name', 'Role', 'Designation', 'Department', 'Joining Date'];
        for ($d = 1; $d <= $daysInMonth; $d++) $header[] = $d;
        $header = array_merge($header, ['Present', 'Absent', 'Leave', 'Weekends']);
        $rows[] = $header;

        $dayNamesRow = ['', '', '', '', '', '', ''];
        foreach ($dayNames as $n) $dayNamesRow[] = $n;
        $dayNamesRow = array_merge($dayNamesRow, ['', '', '', '']);
        $rows[]      = $dayNamesRow;

        foreach ($users as $i => $user) {
            $records = Attendance::where('user_id', $user->id)
                ->whereYear('date', $year)
                ->whereMonth('date', $month)
                ->get()
                ->keyBy(fn ($r) => (int) $r->date->format('j'));

            $joiningDate = $user->date_of_joining; // Carbon date or null

            $row = [
                $i + 1,
                $user->username,
                $user->display_name,
                ucfirst($user->role),
                $user->agent_type ?? $user->manager_type ?? '—',
                $user->department ?? '—',
                $user->date_of_joining?->format('Y-m-d') ?? '—',
            ];

            $present = 0;
            $absent  = 0;
            $leave   = 0;
            $weekend = 0;

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $date    = Carbon::create($year, $month, $d);
                $dateStr = $date->toDateString();

                // Before joining date → mark as N/J (not joined), don't count as absent
                if ($joiningDate && $dateStr < $joiningDate->toDateString()) {
                    $row[] = 'N/J';
                    continue;
                }

                $isWeekend = in_array($date->dayOfWeek, [0, 6], true);

                if ($isWeekend) {
                    $row[] = 'WE';
                    $weekend++;
                } elseif (isset($records[$d])) {
                    $s = $records[$d]->status;
                    $row[] = strtoupper(substr($s, 0, 1));
                    if ($s === 'present' || $s === 'late') $present++; // late = present
                    elseif ($s === 'absent') $absent++;
                    elseif ($s === 'leave') $leave++;
                } else {
                    $row[] = $dateStr < $todayPKT ? 'A' : '—';
                    if ($dateStr < $todayPKT) $absent++;
                }
            }

            $row    = array_merge($row, [$present, $absent, $leave, $weekend]);
            $rows[] = $row;
        }

        $csv = implode("\n", array_map(
            fn ($r) => implode(',', array_map(
                fn ($v) => '"' . str_replace('"', '""', (string) $v) . '"',
                $r
            )),
            $rows
        ));

        return response()->json([
            'csv'      => $csv,
            'filename' => "attendance_{$monthName}_{$year}.csv",
        ]);
    }

    // ── APPROVAL LIST ──────────────────────────────────────────────────────────
    // GET /api/attendance/approval?date=2026-05-12&status=pending&search=
    public function approvalList(Request $request): JsonResponse
    {
        $this->requireHrAccess();

        $date   = $request->input('date', $this->todayPKT());
        $status = $request->input('status');
        $search = $request->input('search');

        $query = Attendance::with('user')
            ->whereDate('date', $date)
            ->whereHas('user', fn ($q) => $q->whereIn('role', ['manager', 'agent']));

        if ($status && $status !== 'all') {
            $query->where('approval_status', $status);
        }

        if ($search) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('display_name', 'like', "%$search%")
                  ->orWhere('username', 'like', "%$search%");
            });
        }

        $records = $query->get()->map(fn ($rec) => [
            'id'              => $rec->id,
            'user_id'         => $rec->user->id,
            'username'        => $rec->user->username,
            'display_name'    => $rec->user->display_name,
            'role'            => $rec->user->role,
            'manager_type'    => $rec->user->manager_type,
            'agent_type'      => $rec->user->agent_type,
            'department'      => $rec->user->department,
            'date'            => $rec->date->format('D, M j, Y'),
            'date_raw'        => $rec->date->format('Y-m-d'),
            'login_time'      => $rec->edited_login_time ?? $rec->login_time_formatted,
            'original_time'   => $rec->login_time_formatted,
            'status'          => $rec->status,
            'approval_status' => $rec->approval_status,
            'is_late'         => (bool) $rec->is_late,
            'late_minutes'    => $rec->late_minutes,
        ]);

        $allDay = Attendance::whereDate('date', $date)
            ->whereHas('user', fn ($q) => $q->whereIn('role', ['manager', 'agent']))
            ->get();

        $summary = [
            'total'    => $allDay->count(),
            'pending'  => $allDay->where('approval_status', 'pending')->count(),
            'late'     => $allDay->where('is_late', true)->count(),
            'approved' => $allDay->where('approval_status', 'approved')->count(),
            'rejected' => $allDay->where('approval_status', 'rejected')->count(),
        ];

        return response()->json([
            'success' => true,
            'date'    => $date,
            'records' => $records,
            'summary' => $summary,
        ]);
    }

    // ── DAILY ATTENDANCE ───────────────────────────────────────────────────────
    // GET /api/attendance/daily?date=2026-05-12
    public function daily(Request $request): JsonResponse
    {
        $this->requireHrAccess();

        $date = $request->input('date', $this->todayPKT());

        $users = User::whereIn('role', ['manager', 'agent'])
            ->where('is_active', true)
            ->where(fn ($q) => $q->where('role', 'agent')->orWhere('manager_type', '!=', 'Accountant'))
            ->orderByRaw("FIELD(role,'manager','agent')")
            ->orderBy('username')
            ->get();

        $records = Attendance::with('user')
            ->whereDate('date', $date)
            ->whereHas('user', fn ($q) => $q->whereIn('role', ['manager', 'agent'])
                ->where(fn ($q2) => $q2->where('role', 'agent')->orWhere('manager_type', '!=', 'Accountant')))
            ->get()
            ->keyBy('user_id');

        // Check working_days for this date
        $wd        = \App\Models\WorkingDay::where('date', $date)->first();
        $isLeave   = $wd && $wd->status === 'leave';
        $isWeekend = $wd
            ? $wd->status === 'weekend'
            : in_array(Carbon::parse($date)->dayOfWeek, [0, 6], true);

        $present = [];
        $absent  = [];
        $leave   = [];
        $weekend = [];

        foreach ($users as $user) {
            // Skip users who haven't joined yet on this date
            if ($user->date_of_joining && $date < $user->date_of_joining->toDateString()) {
                continue;
            }

            $entry = [
                'user_id'      => $user->id,
                'username'     => $user->username,
                'display_name' => $user->display_name,
                'role'         => $user->role,
                'manager_type' => $user->manager_type,
                'agent_type'   => $user->agent_type,
                'department'   => $user->department,
            ];

            if ($isLeave) {
                $entry['attendance_id']   = null;
                $entry['login_time']      = null;
                $entry['approval_status'] = null;
                $entry['manually_edited'] = false;
                $entry['is_late']         = false;
                $entry['late_minutes']    = null;
                $leave[] = $entry;
            } elseif ($isWeekend) {
                $entry['attendance_id']   = null;
                $entry['login_time']      = null;
                $entry['approval_status'] = null;
                $entry['manually_edited'] = false;
                $entry['is_late']         = false;
                $entry['late_minutes']    = null;
                $weekend[] = $entry;
            } elseif (isset($records[$user->id])) {
                $rec = $records[$user->id];
                $entry['attendance_id']   = $rec->id;
                $entry['login_time']      = $rec->edited_login_time ?? $rec->login_time_formatted;
                $entry['approval_status'] = $rec->approval_status;
                $entry['manually_edited'] = (bool) $rec->manually_edited;
                $entry['is_late']         = (bool) $rec->is_late;
                $entry['late_minutes']    = $rec->late_minutes;

                if ($rec->status === 'present') {
                    $present[] = $entry;
                } else {
                    $absent[] = $entry;
                }
            } else {
                $entry['attendance_id']   = null;
                $entry['login_time']      = null;
                $entry['approval_status'] = null;
                $entry['manually_edited'] = false;
                $entry['is_late']         = false;
                $entry['late_minutes']    = null;
                $absent[] = $entry;
            }
        }

        return response()->json([
            'success'      => true,
            'date'         => $date,
            'is_leave'     => $isLeave,
            'is_weekend'   => $isWeekend,
            'leave_reason' => $wd?->leave_reason,
            'present'      => $present,
            'absent'       => $absent,
            'leave'        => $leave,
            'weekend'      => $weekend,
            'summary'      => [
                'present' => count($present),
                'absent'  => count($absent),
                'leave'   => count($leave),
                'weekend' => count($weekend),
                'total'   => count($present) + count($absent) + count($leave) + count($weekend),
                'late'    => collect(array_merge($present, $absent))->where('is_late', true)->count(),
            ],
        ]);
    }

    // ── HR MANUAL EDIT (from report calendar modal) ────────────────────────────
    // PATCH /api/attendance/hr-edit
    public function hrEdit(Request $request): JsonResponse
    {
        $this->requireHrAccess();

        $request->validate([
            'user_id'    => 'required|integer|exists:users,id',
            'date'       => 'required|date_format:Y-m-d',
            'action'     => 'required|in:mark_present,mark_absent,mark_leave',
            'login_time' => 'nullable|string|max:20',
        ]);

        $hr   = auth()->user();
        $date = $request->date;

        if ($request->action === 'mark_present') {
            $loginTime = $request->login_time ?? '9:00 AM';
            Attendance::updateOrCreate(
                ['user_id' => $request->user_id, 'date' => $date],
                [
                    'status'               => 'present',
                    'approval_status'      => 'approved',
                    'login_time_formatted' => $loginTime,
                    'edited_login_time'    => $loginTime,
                    'manually_edited'      => true,
                    'approved_by'          => $hr->id,
                    'approved_at'          => now(),
                ]
            );
        } elseif ($request->action === 'mark_absent') {
            Attendance::updateOrCreate(
                ['user_id' => $request->user_id, 'date' => $date],
                [
                    'status'          => 'absent',
                    'approval_status' => 'rejected',
                    'manually_edited' => true,
                    'approved_by'     => $hr->id,
                    'approved_at'     => now(),
                ]
            );
        } else {
            // mark_leave
            Attendance::updateOrCreate(
                ['user_id' => $request->user_id, 'date' => $date],
                [
                    'status'          => 'leave',
                    'approval_status' => 'approved',
                    'manually_edited' => true,
                    'approved_by'     => $hr->id,
                    'approved_at'     => now(),
                ]
            );
        }

        return response()->json(['success' => true]);
    }

    // ── APPROVE ────────────────────────────────────────────────────────────────
    // PATCH /api/attendance/{attendance}/approve
    public function approve(Attendance $attendance): JsonResponse
    {
        $this->requireHrAccess();

        $attendance->update([
            'approval_status' => 'approved',
            'approved_by'     => auth()->id(),
            'approved_at'     => now(),
        ]);

        return response()->json(['success' => true, 'message' => 'Attendance approved.']);
    }

    // ── REJECT / MARK ABSENT ───────────────────────────────────────────────────
    // PATCH /api/attendance/{attendance}/reject
    public function reject(Attendance $attendance): JsonResponse
    {
        $this->requireHrAccess();

        $attendance->update([
            'status'          => 'absent',
            'approval_status' => 'rejected',
            'approved_by'     => auth()->id(),
            'approved_at'     => now(),
        ]);

        return response()->json(['success' => true, 'message' => 'Marked as absent.' ]);
    }

    // ── EDIT LOGIN TIME ────────────────────────────────────────────────────────
    // PATCH /api/attendance/{attendance}/edit-time
    public function editTime(Request $request, Attendance $attendance): JsonResponse
    {
        $this->requireHrAccess();

        $request->validate([
            'time' => 'required|string|max:20',
        ]);

        $attendance->update([
            'edited_login_time' => $request->time,
            'manually_edited'   => true,
        ]);

        return response()->json(['success' => true, 'message' => 'Login time updated.']);
    }
}
