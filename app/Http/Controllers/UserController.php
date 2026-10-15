<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const HIERARCHY = ['admin', 'director', 'manager', 'agent'];

    private const ROLE_ORDER = ['admin' => 1, 'director' => 2, 'manager' => 3, 'agent' => 4];

    private const DEPARTMENTS = ['Medicare', 'Final Expense', 'ACA', 'Management'];

    private function rolesBelow(string $role): array
    {
        $pos = array_search($role, self::HIERARCHY, true);
        return $pos === false ? [] : array_slice(self::HIERARCHY, $pos + 1);
    }

    private const ROLE_PREFIX = ['director' => 'D', 'manager' => 'M', 'agent' => 'A'];

    /** Returns the next available username code for a given role. */
    public function nextCode(Request $request): JsonResponse
    {
        $role   = $request->query('role', '');
        $prefix = self::ROLE_PREFIX[$role] ?? null;

        if (! $prefix) {
            return response()->json(['code' => ''], 422);
        }

        $max = User::where('role', $role)
            ->where('username', 'like', $prefix . '%')
            ->selectRaw('MAX(CAST(SUBSTRING(username, 2) AS UNSIGNED)) as max_num')
            ->value('max_num') ?? 0;

        return response()->json([
            'code' => $prefix . str_pad($max + 1, 3, '0', STR_PAD_LEFT),
        ]);
    }

    /**
     * index — paginated user list scoped to caller's role.
     * Supports: role filter, status filter (active/inactive/all), search, hierarchy sort.
     */
    public function index(Request $request): JsonResponse
    {
        $auth = $request->user();

        $query = match ($auth->role) {
            'admin'    => User::query(),
            'director' => User::whereIn('role', ['director', 'manager', 'agent']),
            'manager'  => User::whereIn('role', ['manager', 'agent']),
            default    => abort(403, 'Forbidden.'),
        };

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        // Status filter: active (default) / inactive / all
        $status = $request->query('status', 'active');
        if ($status === 'active') {
            $query->where('is_active', 1);
        } elseif ($status === 'inactive') {
            $query->where('is_active', 0);
        }
        // 'all' → no filter

        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(function ($q) use ($s) {
                $q->where('username', 'like', $s)
                  ->orWhere('display_name', 'like', $s)
                  ->orWhere('first_name', 'like', $s)
                  ->orWhere('last_name', 'like', $s)
                  ->orWhere('email', 'like', $s)
                  ->orWhere('phone', 'like', $s);
            });
        }

        // Hierarchy sort: admin → director → manager → agent, then by display_name
        $query->orderByRaw("FIELD(role, 'admin', 'director', 'manager', 'agent')")
              ->orderBy('username');

        $fields = [
            'id', 'username', 'role', 'display_name',
            'first_name', 'mid_name', 'last_name',
            'email', 'phone', 'date_of_birth', 'date_of_joining',
            'department', 'agent_type', 'manager_type', 'experience',
            'cnic', 'permanent_address', 'current_address', 'address',
            'bank', 'account_title', 'bank_account_no', 'iban_no',
            'basic_salary', 'punctuality_allowance', 'travelling_allowance', 'other_allowance',
            'is_active', 'inactive_since', 'profile_locked', 'created_at', 'extra_fields',
        ];

        $query->select($fields);

        // Export CSV
        if ($request->query('format') === 'csv') {
            return $this->exportCsv($query->get());
        }

        if ($request->query('per_page') === 'all') {
            return response()->json($query->get());
        }

        return response()->json($query->paginate(20));
    }

    /** Export users as CSV download. */
    private function exportCsv($users): JsonResponse
    {
        $rows[] = [
            // Account
            'User ID', 'Role', 'Role Type', 'Display Name', 'Status', 'Inactive Since',
            // Personal
            'First Name', 'Middle Name', 'Last Name',
            'Email', 'Phone', 'Date of Birth', 'Date of Joining',
            // Professional
            'Department', 'Experience',
            // CNIC & Address
            'CNIC', 'Permanent Address', 'Current Address',
            // Banking
            'Bank', 'Account Title', 'Account No.', 'IBAN No.',
            // Salary
            'Basic Salary', 'Punctuality Allowance', 'Travelling Allowance', 'Other Allowance', 'Total Package',
        ];

        foreach ($users as $u) {
            $roleType = $u->agent_type ?? $u->manager_type ?? '';
            $total    = (float)$u->basic_salary + (float)$u->punctuality_allowance
                      + (float)$u->travelling_allowance + (float)$u->other_allowance;

            $rows[] = [
                // Account
                $u->username,
                ucfirst($u->role),
                $roleType,
                $u->display_name ?? '',
                $u->is_active ? 'Active' : 'Inactive',
                $u->inactive_since?->format('Y-m-d') ?? '',
                // Personal
                $u->first_name ?? '',
                $u->mid_name   ?? '',
                $u->last_name  ?? '',
                $u->email      ?? '',
                $u->phone      ?? '',
                $u->date_of_birth?->format('Y-m-d')    ?? '',
                $u->date_of_joining?->format('Y-m-d')  ?? '',
                // Professional
                $u->department ?? '',
                $u->experience ?? '',
                // CNIC & Address
                $u->cnic               ?? '',
                $u->permanent_address  ?? '',
                $u->current_address    ?? '',
                // Banking
                $u->bank           ?? '',
                $u->account_title  ?? '',
                $u->bank_account_no ?? '',
                $u->iban_no        ?? '',
                // Salary
                $u->basic_salary            ?? '',
                $u->punctuality_allowance   ?? '',
                $u->travelling_allowance    ?? '',
                $u->other_allowance         ?? '',
                $total > 0 ? $total : '',
            ];
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
            'filename' => 'users_' . now()->format('Ymd_His') . '.csv',
        ]);
    }

    /** store — create a user whose role is strictly below the caller's. */
    public function store(Request $request): JsonResponse
    {
        $auth         = $request->user();
        $allowedRoles = $this->rolesBelow($auth->role);

        if (empty($allowedRoles)) {
            return response()->json(['success' => false, 'message' => 'You are not allowed to create users.'], 403);
        }

        $data = $request->validate([
            'username'               => 'required|string|max:100|unique:users,username',
            'password'               => 'required|string|min:8',
            'role'                   => ['required', Rule::in($allowedRoles)],
            'display_name'           => 'required|string|max:255',
            'first_name'             => 'required|string|max:100',
            'mid_name'               => 'nullable|string|max:100',
            'last_name'              => 'required|string|max:100',
            'email'                  => 'nullable|email|unique:users,email',
            'phone'                  => 'nullable|string|max:30',
            'date_of_birth'          => 'nullable|date',
            'date_of_joining'        => 'required|date',
            'address'                => 'nullable|string',
            'cnic'                   => ['nullable', 'string', 'regex:/^\d{5}-\d{7}-\d{1}$/'],
            'permanent_address'      => 'nullable|string',
            'current_address'        => 'nullable|string',
            'experience'             => 'nullable|string|max:255',
            'department'             => ['nullable', Rule::in(self::DEPARTMENTS)],
            'agent_type'             => ['nullable', Rule::in(['Closer', 'Verifier', 'Self Closer', 'Fronter'])],
            'manager_type'           => ['nullable', Rule::in(['Floor Manager/Team Lead', 'QA Manager', 'HR Manager', 'Accountant'])],
            'bank'                   => 'nullable|string|max:255',
            'account_title'          => 'nullable|string|max:255',
            'bank_account_no'        => 'nullable|string|max:100',
            'iban_no'                => 'nullable|string|max:100',
            'basic_salary'           => 'nullable|numeric|min:0',
            'punctuality_allowance'  => 'nullable|numeric|min:0',
            'travelling_allowance'   => 'nullable|numeric|min:0',
            'other_allowance'        => 'nullable|numeric|min:0',
            'extra_fields'           => 'nullable|array',
        ]);

        $data['password']   = Hash::make($data['password']);
        $data['created_by'] = $auth->id;

        $user = User::create($data);

        return response()->json(['success' => true, 'user' => $user], 201);
    }

    /** update — edit an existing user with role-scoped permission. */
    public function update(Request $request, User $user): JsonResponse
    {
        $auth = $request->user();

        $canEdit = match ($auth->role) {
            'admin'    => true,
            'director' => in_array($user->role, ['manager', 'agent'], true),
            'manager'  => $user->role === 'agent',
            default    => false,
        };

        if (! $canEdit) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($request->has('role')) {
            if ($user->id === $auth->id) {
                return response()->json(['success' => false, 'message' => 'You cannot change your own role.'], 422);
            }
            if (! in_array($request->role, $this->rolesBelow($auth->role), true)) {
                return response()->json(['success' => false, 'message' => 'You cannot assign a role equal to or above your own.'], 422);
            }
        }

        $data = $request->validate([
            'username'               => ['sometimes', 'string', 'max:100', Rule::unique('users', 'username')->ignore($user->id)],
            'password'               => 'sometimes|string|min:8',
            'role'                   => ['sometimes', Rule::in(self::HIERARCHY)],
            'display_name'           => 'sometimes|string|max:255',
            'first_name'             => 'sometimes|string|max:100',
            'mid_name'               => 'nullable|string|max:100',
            'last_name'              => 'sometimes|string|max:100',
            'email'                  => ['nullable', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'                  => 'nullable|string|max:30',
            'date_of_birth'          => 'nullable|date',
            'date_of_joining'        => 'nullable|date',
            'address'                => 'nullable|string',
            'cnic'                   => ['nullable', 'string', 'regex:/^\d{5}-\d{7}-\d{1}$/'],
            'permanent_address'      => 'nullable|string',
            'current_address'        => 'nullable|string',
            'experience'             => 'nullable|string|max:255',
            'department'             => ['nullable', Rule::in(self::DEPARTMENTS)],
            'agent_type'             => ['nullable', Rule::in(['Closer', 'Verifier', 'Self Closer', 'Fronter'])],
            'manager_type'           => ['nullable', Rule::in(['Floor Manager/Team Lead', 'QA Manager', 'HR Manager', 'Accountant'])],
            'bank'                   => 'nullable|string|max:255',
            'account_title'          => 'nullable|string|max:255',
            'bank_account_no'        => 'nullable|string|max:100',
            'iban_no'                => 'nullable|string|max:100',
            'basic_salary'           => 'nullable|numeric|min:0',
            'punctuality_allowance'  => 'nullable|numeric|min:0',
            'travelling_allowance'   => 'nullable|numeric|min:0',
            'other_allowance'        => 'nullable|numeric|min:0',
            'extra_fields'           => 'nullable|array',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        return response()->json(['success' => true, 'user' => $user->fresh()]);
    }

    /**
     * destroy — disable user (set is_active=0, record inactive_since date).
     * Admin or Director can disable. Cannot disable yourself.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $auth = $request->user();

        $canDisable = match ($auth->role) {
            'admin'   => true,
            'director'=> $user->role !== 'admin',
            'manager' => $user->role === 'agent',
            default   => false,
        };

        if (! $canDisable) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($user->id === $auth->id) {
            return response()->json(['success' => false, 'message' => 'You cannot deactivate your own account.'], 422);
        }

        $request->validate([
            'inactive_since' => 'required|date',
        ]);

        $user->update([
            'is_active'      => 0,
            'inactive_since' => $request->inactive_since,
        ]);

        return response()->json(['success' => true, 'message' => 'User disabled.']);
    }

    /**
     * activate — re-activate a disabled user. Director or Admin only.
     */
    public function activate(Request $request, User $user): JsonResponse
    {
        $auth = $request->user();

        $canActivate = match ($auth->role) {
            'admin'   => true,
            'director'=> $user->role !== 'admin',
            'manager' => $user->role === 'agent',
            default   => false,
        };

        if (! $canActivate) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        $user->update([
            'is_active'      => 1,
            'inactive_since' => null,
        ]);

        return response()->json(['success' => true, 'message' => 'User re-activated.']);
    }

    /** toggleLock — flip profile_locked. Admin only. */
    public function toggleLock(Request $request, User $user): JsonResponse
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        $user->update(['profile_locked' => ! $user->profile_locked]);

        return response()->json([
            'success'        => true,
            'profile_locked' => $user->profile_locked,
        ]);
    }
}
