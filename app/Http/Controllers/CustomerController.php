<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $auth = $request->user();

        $query = match ($auth->role) {
            'agent'   => Customer::where('agent_id', $auth->id),
            default   => Customer::query(),
        };

        $validStatuses = ['pending', 'approved', 'disapproved', 'final_approved', 'final_disapproved', 'agent_rejected'];

        if ($request->filled('status') && in_array($request->status, $validStatuses, true)) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('customer_code', 'like', $term)
                  ->orWhere('first_name', 'like', $term)
                  ->orWhere('last_name', 'like', $term);
            });
        }

        $clientSelect = in_array($auth->role, ['admin', 'director'], true)
            ? 'client:id,did_code,company_name,rate_type,sale_type,rate_of_sale_amount'
            : 'client:id,did_code,rate_type,sale_type';

        $customers = $query
            ->with([$clientSelect, 'agent:id,username,display_name'])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($customers);
    }

    public function store(Request $request): JsonResponse
    {
        $auth = $request->user();

        if ($auth->role !== 'agent') {
            return response()->json(['success' => false, 'message' => 'Only agents can submit sales.'], 403);
        }

        $data = $request->validate([
            'first_name'       => 'required|string|max:100',
            'mid_name'         => 'nullable|string|max:100',
            'last_name'        => 'required|string|max:100',
            'age'              => 'required|integer|min:0|max:130',
            'date_of_birth'    => 'nullable|date',
            'phone'            => 'nullable|string|max:30',
            'address'          => 'nullable|string',
            'city'             => 'nullable|string|max:100',
            'state'            => 'required|string|max:100',
            'postal_code'      => 'required|string|max:20',
            'vertical_type'    => 'nullable|string|max:50',
            'vertical_other'   => 'nullable|string|max:255',
            'did_comments'     => 'nullable|string',
            'transferred_from' => 'required|string|max:255',
            'reason'           => 'nullable|string|max:50',
            'client_id'        => 'required_unless:vertical_type,Other|exists:clients,id',
        ]);

        // Auto-record submission time in both timezones — system-generated, not editable
        $data['submitted_at_pak'] = now()->setTimezone('Asia/Karachi')->format('d M Y h:i A') . ' PKT';
        $data['submitted_at_est'] = now()->setTimezone('America/New_York')->format('d M Y h:i A') . ' EST';

        $data['agent_id'] = $auth->id;
        // If agent filled Reason of Cancellation, record it but keep out of approval pipeline
        $data['status']   = !empty($data['reason']) ? 'agent_rejected' : 'pending';

        // Capture any custom (non-standard) fields submitted via the dynamic form
        $standardKeys = [
            'first_name', 'mid_name', 'last_name', 'age', 'date_of_birth', 'phone',
            'address', 'city', 'state', 'postal_code', 'vertical_type', 'vertical_other',
            'did_comments', 'transferred_from', 'reason', 'client_id',
        ];
        $extra = collect($request->all())
            ->except(array_merge($standardKeys, ['_token']))
            ->filter(fn($v) => $v !== null && $v !== '')
            ->toArray();
        if (!empty($extra)) {
            $data['extra_fields'] = $extra;
        }

        $customer = Customer::create($data);

        // Use the auto-increment ID to generate the code — O(1), no table scan, scales to billions
        $customer->update(['customer_code' => 'C' . str_pad($customer->id, 7, '0', STR_PAD_LEFT)]);

        return response()->json(['success' => true, 'customer' => $customer->load('client:id,did_code')], 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $auth = $request->user();

        if (! in_array($auth->role, ['manager', 'director', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'first_name'        => 'sometimes|string|max:100',
            'mid_name'          => 'nullable|string|max:100',
            'last_name'         => 'sometimes|string|max:100',
            'date_of_birth'     => 'nullable|date',
            'phone'             => 'nullable|string|max:30',
            'address'           => 'nullable|string',
            'city'              => 'nullable|string|max:100',
            'state'             => 'nullable|string|max:100',
            'postal_code'       => 'nullable|string|max:20',
            'vertical_type'     => 'nullable|string|max:50',
            'vertical_other'    => 'nullable|string|max:255',
            'client_id'         => 'nullable|exists:clients,id',
            'did_comments'      => 'nullable|string',
            'transferred_from'  => 'nullable|string|max:255',
            'verifiers_part'    => 'nullable|string|max:255',
            'lead_id_timestamp' => 'nullable|string|max:255',
            'reason'            => 'nullable|string|max:50',
        ]);

        $customer->update($data);

        $clientSelect = in_array($auth->role, ['admin', 'director'], true)
            ? 'client:id,did_code,company_name,rate_type,sale_type,rate_of_sale_amount'
            : 'client:id,did_code,rate_type,sale_type';

        return response()->json([
            'success'  => true,
            'customer' => $customer->fresh()->load(['agent:id,username,display_name', $clientSelect]),
        ]);
    }

    public function approve(Request $request, Customer $customer): JsonResponse
    {
        $auth = $request->user();

        if (! in_array($auth->role, ['manager', 'director', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($customer->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Only pending customers can be approved.'], 422);
        }

        $request->validate([
            'qa_comments' => 'required|string|max:2000',
        ]);

        $customer->update([
            'status'      => 'approved',
            'manager_id'  => $auth->id,
            'approved_at' => now(),
            'qa_comments' => $request->qa_comments,
        ]);

        return response()->json(['success' => true, 'customer' => $customer->fresh()]);
    }

    public function reject(Request $request, Customer $customer): JsonResponse
    {
        $auth = $request->user();

        if (! in_array($auth->role, ['manager', 'director', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($customer->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Only pending customers can be rejected.'], 422);
        }

        $request->validate([
            'manager_note' => 'required|string|max:255',
            'qa_comments'  => 'required|string|max:2000',
        ]);

        $client = $customer->client;

        $customer->update([
            'status'            => 'disapproved',
            'manager_id'        => $auth->id,
            'manager_note'      => $request->manager_note,
            'qa_comments'       => $request->qa_comments,
            'disapproved_at'    => now(),
            'sale_did_code'     => $client?->did_code,
            'sale_company_name' => $client?->company_name,
            'sale_rate_amount'  => $client?->rate_of_sale_amount,
            'sale_rate_type'    => $client?->rate_type,
        ]);

        return response()->json(['success' => true, 'customer' => $customer->fresh()]);
    }

    public function finalApprove(Request $request, Customer $customer): JsonResponse
    {
        $auth = $request->user();

        if (! in_array($auth->role, ['admin', 'director'], true)) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($customer->status !== 'approved') {
            return response()->json(['success' => false, 'message' => 'Customer must be manager-approved before final approval.'], 422);
        }

        // Load client BEFORE updating so we can snapshot the data at this exact moment.
        // This freezes the DID/rate/company against future client edits.
        $client = $customer->client;

        // Variable-rate clients require the director/admin to enter the actual rate per sale.
        $isVariable = $client?->rate_type === 'variable';

        $request->validate([
            'sale_rate_amount' => $isVariable
                ? 'required|numeric|min:0'
                : 'nullable|numeric|min:0',
        ]);

        $rateAmount = $isVariable
            ? $request->sale_rate_amount
            : $client?->rate_of_sale_amount;

        $customer->update([
            'status'            => 'final_approved',
            'final_approved_at' => now(),
            'sale_did_code'     => $client?->did_code,
            'sale_company_name' => $client?->company_name,
            'sale_rate_amount'  => $rateAmount,
            'sale_rate_type'    => $client?->rate_type,
        ]);

        return response()->json(['success' => true, 'customer' => $customer->fresh()]);
    }

    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        $auth = $request->user();

        if (! in_array($auth->role, ['admin', 'director'], true)) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        $customer->delete(); // hard delete — permanent, no recovery

        return response()->json(['success' => true, 'message' => 'Record permanently deleted.']);
    }

    public function finalReject(Request $request, Customer $customer): JsonResponse
    {
        $auth = $request->user();

        if (! in_array($auth->role, ['admin', 'director'], true)) {
            return response()->json(['success' => false, 'message' => 'Forbidden.'], 403);
        }

        if (! in_array($customer->status, ['approved', 'pending'], true)) {
            return response()->json(['success' => false, 'message' => 'Cannot final-reject this record.'], 422);
        }

        $client = $customer->client;

        $customer->update([
            'status'               => 'final_disapproved',
            'reason'               => 'Rejected by Client',
            'final_note'           => 'Rejected by Client',
            'final_disapproved_at' => now(),
            'sale_did_code'        => $client?->did_code,
            'sale_company_name'    => $client?->company_name,
            'sale_rate_amount'     => $client?->rate_of_sale_amount,
            'sale_rate_type'       => $client?->rate_type,
        ]);

        return response()->json(['success' => true, 'customer' => $customer->fresh()]);
    }
}
