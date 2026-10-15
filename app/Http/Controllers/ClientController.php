<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Did;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    /**
     * Dropdown for NewSale — returns only clients that have a DID assigned.
     * Agents see the DID code only, never the company name.
     */
    public function dropdown(Request $request): JsonResponse
    {
        $query = Client::where('is_active', 1)
            ->whereNotNull('did_code')
            ->select(['id', 'did_code', 'campaign', 'sale_type']);

        if ($request->filled('campaign')) {
            $query->where('campaign', $request->campaign);
        }

        $clients = $query
            ->orderBy('campaign')
            ->orderByRaw('CAST(SUBSTRING(did_code, 3) AS UNSIGNED)')
            ->get();

        return response()->json($clients);
    }

    /**
     * Available DIDs — unassigned active DIDs, optionally filtered by campaign.
     * Used when creating/editing a client to pick a DID.
     */
    public function availableDids(Request $request): JsonResponse
    {
        $assignedCodes = Client::where('is_active', 1)
            ->whereNotNull('did_code')
            ->pluck('did_code');

        $query = Did::where('is_active', 1)
            ->whereNotIn('did_code', $assignedCodes);

        if ($request->filled('campaign')) {
            $query->where('campaign', $request->campaign);
        }

        // Also include the current client's own DID so edit doesn't break
        if ($request->filled('current_did')) {
            $query->orWhere('did_code', $request->current_did);
        }

        $dids = $query->orderByRaw('CAST(SUBSTRING(did_code, 3) AS UNSIGNED)')
            ->select(['id', 'did_code', 'campaign'])
            ->get();

        return response()->json($dids);
    }

    /** Paginated client list for management. */
    public function index(Request $request): JsonResponse
    {
        $query = Client::query();

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('company_name', 'like', $term)
                  ->orWhere('did_code', 'like', $term);
            });
        }

        if ($request->filled('campaign')) {
            $query->where('campaign', $request->campaign);
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->status === 'active' ? 1 : 0);
        }

        $clients = $query
            ->orderBy('campaign')
            ->orderBy('company_name')
            ->paginate(15);

        return response()->json($clients);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name'             => 'required|string|max:255',
            'campaign'                 => 'required|in:Medicare,Final Expense,ACA',
            'did_code'                 => 'nullable|string|max:10',
            'sale_type'                => 'required|in:CPA,CPL',
            'rate_type'                => 'required|in:fixed,variable',
            'rate_of_sale_amount'      => 'nullable|numeric|min:0|required_if:rate_type,fixed',
            'opening_balance'          => 'nullable|numeric|min:0',
            'cycle_of_day'             => 'required|integer|min:1',
            'billing_start_after_days' => 'required|integer|min:0',
            'notes'                    => 'nullable|string',
            'extra_fields'             => 'nullable|array',
        ]);

        // Validate DID is available if provided
        if (! empty($data['did_code'])) {
            $taken = Client::where('is_active', 1)
                ->where('did_code', $data['did_code'])
                ->exists();

            if ($taken) {
                return response()->json([
                    'message' => 'Validation error.',
                    'errors'  => ['did_code' => ['This DID is already assigned to another active client.']],
                ], 422);
            }
        }

        $data['display_name'] = $data['company_name'];
        $client = Client::create($data);

        return response()->json(['success' => true, 'client' => $client], 201);
    }

    public function update(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'company_name'             => 'sometimes|string|max:255',
            'campaign'                 => 'sometimes|in:Medicare,Final Expense,ACA',
            'did_code'                 => 'nullable|string|max:10',
            'sale_type'                => 'nullable|in:CPA,CPL',
            'rate_type'                => 'sometimes|in:fixed,variable',
            'rate_of_sale_amount'      => 'nullable|numeric|min:0',
            'opening_balance'          => 'nullable|numeric|min:0',
            'cycle_of_day'             => 'required|integer|min:1',
            'billing_start_after_days' => 'required|integer|min:0',
            'notes'                    => 'nullable|string',
            'extra_fields'             => 'nullable|array',
        ]);

        // Validate DID is available if being changed
        if (array_key_exists('did_code', $data) && $data['did_code'] !== $client->did_code) {
            if (! empty($data['did_code'])) {
                $taken = Client::where('is_active', 1)
                    ->where('did_code', $data['did_code'])
                    ->where('id', '!=', $client->id)
                    ->exists();

                if ($taken) {
                    return response()->json([
                        'message' => 'Validation error.',
                        'errors'  => ['did_code' => ['This DID is already assigned to another active client.']],
                    ], 422);
                }
            }
        }

        $client->update($data);

        return response()->json(['success' => true, 'client' => $client->fresh()]);
    }

    public function toggleActive(Client $client): JsonResponse
    {
        $client->update(['is_active' => ! $client->is_active]);

        return response()->json(['success' => true, 'is_active' => $client->is_active]);
    }
}
