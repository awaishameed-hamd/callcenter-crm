<?php
namespace App\Http\Controllers;

use App\Models\FormFieldSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CrmController extends Controller
{
    private const ALLOWED_FORM_TYPES = ['sale', 'profile', 'client', 'user'];

    private function adminOnly(): void
    {
        if (auth()->user()?->role !== 'admin') {
            abort(403, 'Admin only.');
        }
    }

    private function resolveFormType(Request $request, string $routeParam = null): string
    {
        $type = $routeParam ?? $request->input('form_type', 'sale');
        return in_array($type, self::ALLOWED_FORM_TYPES, true) ? $type : 'sale';
    }

    // ── Form Fields — Admin ──────────────────────────────────────────────────

    /** Return all fields for a form_type (admin management view). */
    public function getFormFields(Request $request)
    {
        $this->adminOnly();
        $formType = $this->resolveFormType($request);
        return response()->json(
            FormFieldSetting::where('form_type', $formType)->orderBy('sort_order')->get()
        );
    }

    /** Bulk-update existing fields. */
    public function updateFormFields(Request $request)
    {
        $this->adminOnly();

        $formType = $this->resolveFormType($request);
        $fields   = $request->input('fields', []);

        $validTypes = ['text', 'number', 'select', 'date', 'textarea', 'amount_usd', 'amount_pkr'];

        foreach ($fields as $f) {
            $update = [
                'label'         => $f['label'],
                'is_visible'    => $f['is_visible'],
                'is_required'   => !empty($f['is_required']),
                'sort_order'    => $f['sort_order'] ?? 0,
                'placeholder'   => $f['placeholder'] ?? null,
                'section'       => $f['section'] ?? null,
                'col_span'      => $f['col_span'] ?? 'third',
                'textarea_rows' => max(1, min(20, intval($f['textarea_rows'] ?? 3))),
            ];

            // Allow field_type changes (e.g. text → select) via the Edit Field popup
            if (isset($f['field_type']) && in_array($f['field_type'], $validTypes, true)) {
                $update['field_type'] = $f['field_type'];
            }

            if (array_key_exists('options', $f)) {
                $update['options'] = is_array($f['options']) && count($f['options']) > 0
                    ? $f['options']
                    : null;
            }

            FormFieldSetting::where('form_type', $formType)
                            ->where('field_key', $f['field_key'])
                            ->update($update);
        }

        return response()->json(['message' => 'Form fields updated.']);
    }

    /** Create a brand-new custom field for a form_type. */
    public function createField(Request $request)
    {
        $this->adminOnly();

        $formType = $this->resolveFormType($request);

        $request->validate([
            'field_key'     => [
                'required', 'string', 'regex:/^[a-z][a-z0-9_]*$/', 'max:60',
                Rule::unique('form_field_settings')->where('form_type', $formType),
            ],
            'label'         => 'required|string|max:100',
            'field_type'    => 'required|in:text,number,select,date,textarea,amount_usd,amount_pkr',
            'section'       => 'nullable|string|max:100',
            'placeholder'   => 'nullable|string|max:255',
            'col_span'      => 'nullable|in:full,two_thirds,half,third',
            'textarea_rows' => 'nullable|integer|min:1|max:20',
            'is_visible'    => 'boolean',
            'is_required'   => 'boolean',
            'options'       => 'nullable|array',
            'options.*'     => 'string|max:100',
            'sort_order'    => 'integer',
        ]);

        $field = FormFieldSetting::create([
            'form_type'     => $formType,
            'field_key'     => $request->field_key,
            'label'         => $request->label,
            'field_type'    => $request->field_type,
            'section'       => $request->section,
            'placeholder'   => $request->placeholder,
            'col_span'      => $request->col_span ?? ($request->field_type === 'textarea' ? 'full' : 'third'),
            'textarea_rows' => $request->textarea_rows ?? 3,
            'is_visible'    => $request->boolean('is_visible', true),
            'is_required'   => $request->boolean('is_required', false),
            'options'       => ($request->field_type === 'select' && $request->options)
                               ? $request->options
                               : null,
            'sort_order'    => $request->sort_order ?? 999,
            'is_core'       => false,
        ]);

        return response()->json($field->fresh(), 201);
    }

    /** Delete a non-core custom field. */
    public function deleteField(string $formType, string $fieldKey)
    {
        $this->adminOnly();

        $formType = in_array($formType, self::ALLOWED_FORM_TYPES, true) ? $formType : 'sale';

        $field = FormFieldSetting::where('form_type', $formType)
                                 ->where('field_key', $fieldKey)
                                 ->firstOrFail();

        if ($field->is_core) {
            return response()->json(['message' => 'Core fields cannot be deleted.'], 403);
        }

        $field->delete();

        return response()->json(['message' => 'Field deleted.']);
    }

    // ── Form Fields — Public (agents / users) ────────────────────────────────

    /** Returns visible field config for a given form_type. */
    public function publicFormFields(Request $request)
    {
        $formType = $this->resolveFormType($request);

        return response()->json(
            FormFieldSetting::where('form_type', $formType)
                ->where('is_visible', true)
                ->orderBy('sort_order')
                ->get(['field_key', 'label', 'placeholder', 'is_required', 'field_type',
                       'options', 'is_core', 'section', 'col_span', 'textarea_rows'])
        );
    }

    // ── User Role ────────────────────────────────────────────────────────────

    public function updateUserRole(Request $request, User $user)
    {
        $this->adminOnly();

        $request->validate([
            'role' => 'required|in:agent,manager,director,admin',
        ]);

        $user->update(['role' => $request->role]);

        return response()->json(['message' => 'Role updated.', 'user' => $user->fresh()]);
    }
}
