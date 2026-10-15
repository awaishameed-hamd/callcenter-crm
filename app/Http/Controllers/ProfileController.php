<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->profile_locked) {
            return response()->json(['success' => false, 'message' => 'Your profile is locked. Contact an administrator.'], 403);
        }

        $data = $request->validate([
            'display_name'       => 'sometimes|string|max:255',
            'first_name'         => 'sometimes|string|max:100',
            'mid_name'           => 'nullable|string|max:100',
            'last_name'          => 'sometimes|string|max:100',
            'email'              => ['nullable', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'              => 'nullable|string|max:30',
            'date_of_birth'      => 'nullable|date',
            'date_of_joining'    => 'required|date',
            'address'            => 'nullable|string',
            'experience'         => 'nullable|string|max:255',
            'cnic'               => 'nullable|string|max:15',
            'permanent_address'  => 'nullable|string',
            'current_address'    => 'nullable|string',
            'bank'               => 'nullable|string|max:255',
            'account_title'      => 'nullable|string|max:255',
            'bank_account_no'    => 'nullable|string|max:100',
            'iban_no'            => 'nullable|string|max:100',
            'extra_fields'       => 'nullable|array',
        ]);

        $user->update($data);

        return response()->json([
            'success' => true,
            'user'    => $this->profileData($user->fresh()),
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'new_password'     => 'required|string|min:8|confirmed',
        ]);

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'success' => false,
                'errors'  => ['current_password' => ['Current password is incorrect.']],
            ], 422);
        }

        $user->update(['password' => Hash::make($request->new_password)]);

        return response()->json(['success' => true, 'message' => 'Password updated successfully.']);
    }

    private function profileData($user): array
    {
        return [
            'id'                       => $user->id,
            'username'                 => $user->username,
            'role'                     => $user->role,
            'agent_type'               => $user->agent_type,
            'manager_type'             => $user->manager_type,
            'display_name'             => $user->display_name,
            'first_name'               => $user->first_name,
            'mid_name'                 => $user->mid_name,
            'last_name'                => $user->last_name,
            'email'                    => $user->email,
            'phone'                    => $user->phone,
            'date_of_birth'            => $user->date_of_birth?->toDateString(),
            'date_of_joining'          => $user->date_of_joining?->toDateString(),
            'department'               => $user->department,
            'experience'               => $user->experience,
            'address'                  => $user->address,
            'cnic'                     => $user->cnic,
            'permanent_address'        => $user->permanent_address,
            'current_address'          => $user->current_address,
            'bank'                     => $user->bank,
            'account_title'            => $user->account_title,
            'bank_account_no'          => $user->bank_account_no,
            'iban_no'                  => $user->iban_no,
            'basic_salary'             => $user->basic_salary,
            'punctuality_allowance'    => $user->punctuality_allowance,
            'travelling_allowance'     => $user->travelling_allowance,
            'other_allowance'          => $user->other_allowance,
            'profile_locked'           => $user->profile_locked,
            'is_active'                => $user->is_active,
            'extra_fields'             => $user->extra_fields ?? [],
        ];
    }
}
