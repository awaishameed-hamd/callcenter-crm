<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(['success' => false, 'message' => 'Invalid credentials.'], 401);
        }

        if (! $user->is_active) {
            return response()->json(['success' => false, 'message' => 'Account is inactive.'], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        // ─── AUTO ATTENDANCE MARK (uses working_days table) ──────────────────
        $attendanceMarked = false;
        $attendanceInfo   = null;

        if (in_array($user->role, ['manager', 'agent'])) {
            $nowPKT   = now()->setTimezone('Asia/Karachi');
            $todayPKT = $nowPKT->toDateString();

            // Get today's working day record
            $workingDay = \App\Models\WorkingDay::where('date', $todayPKT)->first();

            // Is today a valid working day?
            $isWorkingDay = $workingDay
                ? $workingDay->status === 'working_day'
                : ! in_array($nowPKT->dayOfWeek, [0, 6]); // fallback: Mon–Fri

            if ($isWorkingDay) {
                // Attendance trigger: only determines WHEN attendance is auto-marked (from CRM Management)
                $attendanceTime          = \App\Models\AttendanceSetting::get('default_login_time', '17:00');
                [$attHour, $attMinute]   = array_map('intval', explode(':', $attendanceTime));
                $attendanceThresholdMins = $attHour * 60 + $attMinute;

                $currentTotalMins = (int) $nowPKT->format('G') * 60 + (int) $nowPKT->format('i');

                if ($currentTotalMins >= $attendanceThresholdMins) {
                    $alreadyMarked = \App\Models\Attendance::where('user_id', $user->id)
                        ->where('date', $todayPKT)
                        ->exists();

                    if (! $alreadyMarked) {
                        // Late calculation uses shift login_time from Manage Working Days (NOT attendance trigger time)
                        $isLate      = false;
                        $lateMinutes = null;

                        if ($workingDay && $workingDay->login_time) {
                            [$shiftHour, $shiftMinute] = array_map('intval', explode(':', $workingDay->login_time));
                            $shiftTotalMins = $shiftHour * 60 + $shiftMinute;
                            $marginMinutes  = (int) \App\Models\AttendanceSetting::get('late_margin_minutes', 15);
                            $lateThreshold  = $shiftTotalMins + $marginMinutes;
                            $isLate         = $currentTotalMins > $lateThreshold;
                            $lateMinutes    = $isLate ? ($currentTotalMins - $lateThreshold) : null;
                        }

                        \App\Models\Attendance::create([
                            'user_id'              => $user->id,
                            'date'                 => $todayPKT,
                            'login_time'           => $nowPKT->format('H:i:s'),
                            'login_time_formatted' => $nowPKT->format('g:i A'),
                            'status'               => 'present',
                            'approval_status'      => 'pending',
                            'is_late'              => $isLate,
                            'late_minutes'         => $lateMinutes,
                        ]);

                        $attendanceMarked = true;
                        $attendanceInfo   = [
                            'time'         => $nowPKT->format('g:i A'),
                            'date'         => $nowPKT->format('l, F j, Y'),
                            'is_late'      => $isLate,
                            'late_minutes' => $lateMinutes,
                        ];
                    }
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        // ─── WORKING DAYS POPUP CHECK (HR Manager only) ───────────────────────
        $showWorkingDaysPopup = false;

        if ($user->role === 'manager' && $user->manager_type === 'HR Manager') {
            $nowPKT       = now()->setTimezone('Asia/Karachi');
            $currentMonth = $nowPKT->month;
            $currentYear  = $nowPKT->year;

            $alreadySetup = \App\Models\WorkingDay::where('month', $currentMonth)
                ->where('year', $currentYear)
                ->exists();

            if (! $alreadySetup) {
                $showWorkingDaysPopup = true;
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        return response()->json([
            'success' => true,
            'token'   => $token,
            'user'    => [
                'id'           => $user->id,
                'username'     => $user->username,
                'role'         => $user->role,
                'display_name' => $user->display_name,
                'manager_type'    => $user->manager_type,
                'date_of_joining' => $user->date_of_joining?->toDateString(),
            ],
            'attendance_marked'      => $attendanceMarked,
            'attendance_info'        => $attendanceInfo,
            'show_working_days_popup'=> $showWorkingDaysPopup,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['success' => true, 'message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id'                    => $user->id,
            'username'              => $user->username,
            'role'                  => $user->role,
            'agent_type'            => $user->agent_type,
            'manager_type'          => $user->manager_type,
            'display_name'          => $user->display_name,
            'first_name'            => $user->first_name,
            'mid_name'              => $user->mid_name,
            'last_name'             => $user->last_name,
            'email'                 => $user->email,
            'phone'                 => $user->phone,
            'date_of_birth'         => $user->date_of_birth,
            'date_of_joining'       => $user->date_of_joining,
            'department'            => $user->department,
            'experience'            => $user->experience,
            'address'               => $user->address,
            'cnic'                  => $user->cnic,
            'permanent_address'     => $user->permanent_address,
            'current_address'       => $user->current_address,
            'bank'                  => $user->bank,
            'account_title'         => $user->account_title,
            'bank_account_no'       => $user->bank_account_no,
            'iban_no'               => $user->iban_no,
            'basic_salary'          => $user->basic_salary,
            'punctuality_allowance' => $user->punctuality_allowance,
            'travelling_allowance'  => $user->travelling_allowance,
            'other_allowance'       => $user->other_allowance,
            'profile_locked'        => $user->profile_locked,
            'is_active'             => $user->is_active,
            'extra_fields'          => $user->extra_fields ?? [],
        ]);
    }
}
