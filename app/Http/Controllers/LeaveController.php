<?php

namespace App\Http\Controllers;

use App\Models\Leave;
use Illuminate\Http\Request;

class LeaveController extends Controller
{
    // GET /api/leaves/my — any role
    public function myLeaves(Request $request)
    {
        $leaves = Leave::with(['reviewedBy:id,display_name,role'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['success' => true, 'data' => $leaves]);
    }

    // POST /api/leaves — any role
    public function store(Request $request)
    {
        $data = $request->validate([
            'leave_type' => 'required|string',
            'from_date'  => 'required|date',
            'to_date'    => 'required|date|after_or_equal:from_date',
            'reason'     => 'required|string|min:5',
        ]);

        $from = new \DateTime($data['from_date']);
        $to   = new \DateTime($data['to_date']);
        $days = (int) $from->diff($to)->days + 1;

        $leave = Leave::create([
            'user_id'    => $request->user()->id,
            'leave_type' => $data['leave_type'],
            'from_date'  => $data['from_date'],
            'to_date'    => $data['to_date'],
            'days'       => $days,
            'reason'     => $data['reason'],
            'status'     => 'pending',
        ]);

        return response()->json(['success' => true, 'data' => $leave], 201);
    }

    // GET /api/leaves — manager / director / admin
    public function index(Request $request)
    {
        $user = $request->user();
        if (! in_array($user->role, ['manager', 'director', 'admin'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $leaves = Leave::with([
            'user:id,display_name,username,role',
            'reviewedBy:id,display_name,role',
        ])->latest()->get();

        return response()->json(['success' => true, 'data' => $leaves]);
    }

    // GET /api/leaves/pending-count — manager / director / admin
    public function pendingCount(Request $request)
    {
        $user = $request->user();
        if (! in_array($user->role, ['manager', 'director', 'admin'])) {
            return response()->json(['success' => true, 'count' => 0]);
        }

        $count = Leave::where('status', 'pending')->count();

        return response()->json(['success' => true, 'count' => $count]);
    }

    // POST /api/leaves/{leave}/approve — manager / director / admin
    public function approve(Request $request, Leave $leave)
    {
        $user = $request->user();
        if (! in_array($user->role, ['manager', 'director', 'admin'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $leave->update([
            'status'           => 'approved',
            'reviewed_by_id'   => $user->id,
            'rejection_reason' => null,
        ]);

        return response()->json(['success' => true, 'data' => $leave->fresh(['reviewedBy:id,display_name,role'])]);
    }

    // POST /api/leaves/{leave}/reject — manager / director / admin
    public function reject(Request $request, Leave $leave)
    {
        $user = $request->user();
        if (! in_array($user->role, ['manager', 'director', 'admin'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'rejection_reason' => 'required|string|min:3',
        ]);

        $leave->update([
            'status'           => 'rejected',
            'reviewed_by_id'   => $user->id,
            'rejection_reason' => $data['rejection_reason'],
        ]);

        return response()->json(['success' => true, 'data' => $leave->fresh(['reviewedBy:id,display_name,role'])]);
    }
}
