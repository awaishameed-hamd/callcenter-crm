<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsController extends Controller
{
    private const VALID_STATUSES = ['pending', 'approved', 'disapproved', 'final_approved', 'final_disapproved', 'agent_rejected'];

    private function scopedQuery(Request $request)
    {
        $auth = $request->user();

        return match ($auth->role) {
            'agent' => Customer::where('agent_id', $auth->id),
            default => Customer::query(),
        };
    }

    private function applyFilters($query, Request $request)
    {
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('status') && in_array($request->status, self::VALID_STATUSES, true)) {
            $query->where('status', $request->status);
        }

        if ($request->filled('agent_id')) {
            $query->where('agent_id', $request->agent_id);
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->client_id);
        }

        if ($request->filled('vertical_type')) {
            $query->where('vertical_type', $request->vertical_type);
        }

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'date_from'     => 'nullable|date',
            'date_to'       => 'nullable|date|after_or_equal:date_from',
            'status'        => ['nullable', 'string'],
            'agent_id'      => 'nullable|integer|exists:users,id',
            'client_id'     => 'nullable|integer|exists:clients,id',
            'vertical_type' => 'nullable|string',
        ]);

        $query = $this->scopedQuery($request);
        $this->applyFilters($query, $request);

        $customers = $query
            ->with([
                'agent:id,display_name,username',
                'client:id,did_code,company_name,rate_of_sale_amount,rate_type,sale_type',
            ])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($customers);
    }

    public function export(Request $request): StreamedResponse
    {
        $request->validate([
            'date_from'     => 'nullable|date',
            'date_to'       => 'nullable|date|after_or_equal:date_from',
            'status'        => ['nullable', 'string'],
            'agent_id'      => 'nullable|integer|exists:users,id',
            'client_id'     => 'nullable|integer|exists:clients,id',
            'vertical_type' => 'nullable|string',
        ]);

        $query = $this->scopedQuery($request);
        $this->applyFilters($query, $request);

        $customers = $query
            ->with([
                'agent:id,display_name',
                'client:id,did_code,company_name,rate_of_sale_amount,rate_type,sale_type',
            ])
            ->orderBy('created_at', 'desc')
            ->get();

        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="report_' . now()->format('Ymd_His') . '.csv"',
            'Cache-Control'       => 'no-cache, no-store, must-revalidate',
        ];

        $columns = [
            'Code', 'Agent', 'First Name', 'Mid Name', 'Last Name',
            'Age', 'CX DOB', 'Phone', 'Address', 'City', 'State', 'ZIP',
            'Vertical', 'Vertical Other', 'Comments',
            'Transferred From', 'QA Comments',
            'Reason', 'Rejection Reason', 'DID Code', 'Sale Type', 'Company', 'Rate', 'Rate Type', 'Status',
            'Pak Time (PKT)', 'USA Time (EST)', 'Date Submitted',
        ];

        return response()->stream(function () use ($customers, $columns) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);

            foreach ($customers as $c) {
                fputcsv($handle, [
                    $c->customer_code,
                    $c->agent?->display_name,
                    $c->first_name,
                    $c->mid_name,
                    $c->last_name,
                    $c->age,
                    $c->date_of_birth?->format('Y-m-d'),
                    $c->phone,
                    $c->address,
                    $c->city,
                    $c->state,
                    $c->postal_code,
                    $c->vertical_type,
                    $c->vertical_other,
                    $c->did_comments,
                    $c->transferred_from,
                    $c->qa_comments,
                    $c->reason,
                    match($c->status) {
                        'disapproved'       => $c->manager_note,
                        'final_disapproved' => $c->final_note,
                        default             => null,
                    },
                    $c->client?->did_code,
                    $c->client?->sale_type,
                    $c->client?->company_name,
                    $c->client?->rate_of_sale_amount,
                    $c->client?->rate_type,
                    $c->status,
                    $c->submitted_at_pak,
                    $c->submitted_at_est,
                    $c->created_at?->format('Y-m-d'),
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
