<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DimensionsController extends Controller
{
    // ── Auth helper ──────────────────────────────────────────────────────────
    private function requireAccess(): void
    {
        $role = auth()->user()?->role ?? '';
        if (!in_array($role, ['admin', 'manager', 'accountant'])) {
            abort(403, 'Access denied.');
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LOCATIONS
    // ══════════════════════════════════════════════════════════════════════════

    public function locationsIndex(Request $request): JsonResponse
    {
        $this->requireAccess();
        $q = DB::table('locations');
        if ($search = $request->search) {
            $q->where(fn($s) => $s->where('code', 'like', "%$search%")->orWhere('name', 'like', "%$search%")->orWhere('city', 'like', "%$search%"));
        }
        if ($request->active_only) $q->where('is_active', true);
        return response()->json(['data' => $q->orderBy('code')->get()]);
    }

    public function locationsStore(Request $request): JsonResponse
    {
        $this->requireAccess();
        $data = $request->validate([
            'code'    => 'required|string|max:20|unique:locations,code',
            'name'    => 'required|string|max:255',
            'address' => 'nullable|string|max:500',
            'city'    => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'notes'   => 'nullable|string',
        ]);
        $data['is_active'] = true;
        $id = DB::table('locations')->insertGetId(array_merge($data, ['created_at' => now(), 'updated_at' => now()]));
        return response()->json(['data' => DB::table('locations')->find($id)], 201);
    }

    public function locationsUpdate(Request $request, int $id): JsonResponse
    {
        $this->requireAccess();
        $data = $request->validate([
            'code'    => "required|string|max:20|unique:locations,code,{$id}",
            'name'    => 'required|string|max:255',
            'address' => 'nullable|string|max:500',
            'city'    => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'notes'   => 'nullable|string',
        ]);
        DB::table('locations')->where('id', $id)->update(array_merge($data, ['updated_at' => now()]));
        return response()->json(['data' => DB::table('locations')->find($id)]);
    }

    public function locationsToggle(int $id): JsonResponse
    {
        $this->requireAccess();
        $row = DB::table('locations')->find($id);
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        DB::table('locations')->where('id', $id)->update(['is_active' => !$row->is_active, 'updated_at' => now()]);
        return response()->json(['data' => DB::table('locations')->find($id)]);
    }

    public function locationsDestroy(int $id): JsonResponse
    {
        $this->requireAccess();
        // Future: check if any voucher_lines reference this location
        DB::table('locations')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // COST CENTRES
    // ══════════════════════════════════════════════════════════════════════════

    public function costCentresIndex(Request $request): JsonResponse
    {
        $this->requireAccess();
        $q = DB::table('cost_centres');
        if ($search = $request->search) {
            $q->where(fn($s) => $s->where('code', 'like', "%$search%")->orWhere('name', 'like', "%$search%"));
        }
        if ($request->active_only) $q->where('is_active', true);
        return response()->json(['data' => $q->orderBy('code')->get()]);
    }

    public function costCentresStore(Request $request): JsonResponse
    {
        $this->requireAccess();
        $data = $request->validate([
            'code'        => 'required|string|max:20|unique:cost_centres,code',
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);
        $data['is_active'] = true;
        $id = DB::table('cost_centres')->insertGetId(array_merge($data, ['created_at' => now(), 'updated_at' => now()]));
        return response()->json(['data' => DB::table('cost_centres')->find($id)], 201);
    }

    public function costCentresUpdate(Request $request, int $id): JsonResponse
    {
        $this->requireAccess();
        $data = $request->validate([
            'code'        => "required|string|max:20|unique:cost_centres,code,{$id}",
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);
        DB::table('cost_centres')->where('id', $id)->update(array_merge($data, ['updated_at' => now()]));
        return response()->json(['data' => DB::table('cost_centres')->find($id)]);
    }

    public function costCentresToggle(int $id): JsonResponse
    {
        $this->requireAccess();
        $row = DB::table('cost_centres')->find($id);
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        DB::table('cost_centres')->where('id', $id)->update(['is_active' => !$row->is_active, 'updated_at' => now()]);
        return response()->json(['data' => DB::table('cost_centres')->find($id)]);
    }

    public function costCentresDestroy(int $id): JsonResponse
    {
        $this->requireAccess();
        DB::table('cost_centres')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROJECTS
    // ══════════════════════════════════════════════════════════════════════════

    public function projectsIndex(Request $request): JsonResponse
    {
        $this->requireAccess();
        $q = DB::table('projects');
        if ($search = $request->search) {
            $q->where(fn($s) => $s->where('code', 'like', "%$search%")->orWhere('name', 'like', "%$search%")->orWhere('client_name', 'like', "%$search%"));
        }
        if ($status = $request->status) $q->where('status', $status);
        if ($request->active_only) $q->where('is_active', true);
        return response()->json(['data' => $q->orderBy('code')->get()]);
    }

    public function projectsStore(Request $request): JsonResponse
    {
        $this->requireAccess();
        $data = $request->validate([
            'code'        => 'required|string|max:20|unique:projects,code',
            'name'        => 'required|string|max:255',
            'client_name' => 'nullable|string|max:255',
            'start_date'  => 'nullable|date',
            'end_date'    => 'nullable|date|after_or_equal:start_date',
            'budget'      => 'nullable|numeric|min:0',
            'status'      => 'required|in:active,completed,on_hold,cancelled',
            'description' => 'nullable|string',
        ]);
        $data['is_active'] = true;
        $id = DB::table('projects')->insertGetId(array_merge($data, ['created_at' => now(), 'updated_at' => now()]));
        return response()->json(['data' => DB::table('projects')->find($id)], 201);
    }

    public function projectsUpdate(Request $request, int $id): JsonResponse
    {
        $this->requireAccess();
        $data = $request->validate([
            'code'        => "required|string|max:20|unique:projects,code,{$id}",
            'name'        => 'required|string|max:255',
            'client_name' => 'nullable|string|max:255',
            'start_date'  => 'nullable|date',
            'end_date'    => 'nullable|date|after_or_equal:start_date',
            'budget'      => 'nullable|numeric|min:0',
            'status'      => 'required|in:active,completed,on_hold,cancelled',
            'description' => 'nullable|string',
        ]);
        DB::table('projects')->where('id', $id)->update(array_merge($data, ['updated_at' => now()]));
        return response()->json(['data' => DB::table('projects')->find($id)]);
    }

    public function projectsToggle(int $id): JsonResponse
    {
        $this->requireAccess();
        $row = DB::table('projects')->find($id);
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        DB::table('projects')->where('id', $id)->update(['is_active' => !$row->is_active, 'updated_at' => now()]);
        return response()->json(['data' => DB::table('projects')->find($id)]);
    }

    public function projectsDestroy(int $id): JsonResponse
    {
        $this->requireAccess();
        DB::table('projects')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
