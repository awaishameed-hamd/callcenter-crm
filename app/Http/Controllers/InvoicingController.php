<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoicingController extends Controller
{
    private const TZ = 'Asia/Karachi';

    private function adminOnly(): void
    {
        if (auth()->user()?->role !== 'admin') {
            abort(403, 'Admin only.');
        }
    }

    /** Returns [startUtcString|null, endUtcString|null] for a given period. */
    private function periodUtcRange(string $period, ?string $from, ?string $to): array
    {
        $now = now()->setTimezone(self::TZ);
        return match ($period) {
            'today'  => [
                $now->copy()->startOfDay()->utc()->toDateTimeString(),
                $now->copy()->endOfDay()->utc()->toDateTimeString(),
            ],
            'week'   => [
                $now->copy()->startOfWeek()->startOfDay()->utc()->toDateTimeString(),
                $now->copy()->endOfWeek()->endOfDay()->utc()->toDateTimeString(),
            ],
            'month'  => [
                $now->copy()->startOfMonth()->startOfDay()->utc()->toDateTimeString(),
                $now->copy()->endOfMonth()->endOfDay()->utc()->toDateTimeString(),
            ],
            'custom' => ($from && $to) ? [
                Carbon::parse($from, self::TZ)->startOfDay()->utc()->toDateTimeString(),
                Carbon::parse($to,   self::TZ)->endOfDay()->utc()->toDateTimeString(),
            ] : [null, null],
            default  => [null, null],  // all time
        };
    }

    // ── Revenue Report ────────────────────────────────────────────────────────
    // GET /api/admin/invoicing/revenue-report
    public function revenueReport(Request $request): JsonResponse
    {
        $this->adminOnly();

        $type   = in_array($request->input('type'), ['customer', 'agent', 'vertical', 'client'], true)
                  ? $request->input('type') : 'client';
        $period = $request->input('period', 'month');
        [$startUtc, $endUtc] = $this->periodUtcRange(
            $period,
            $request->input('from_date'),
            $request->input('to_date')
        );

        // Expected Revenue — approved customers
        $expectedQ = Customer::with([
            'agent:id,username,display_name',
            'client:id,company_name,did_code',
        ])->where('status', 'approved');
        if ($startUtc) $expectedQ->whereBetween('created_at', [$startUtc, $endUtc]);
        $expectedAll = $expectedQ->get();

        // Confirmed Revenue — final_approved customers
        $confirmedQ = Customer::with([
            'agent:id,username,display_name',
            'client:id,company_name,did_code',
        ])->where('status', 'final_approved');
        if ($startUtc) $confirmedQ->whereBetween('created_at', [$startUtc, $endUtc]);
        $confirmedAll = $confirmedQ->get();

        // Invoice Revenue — items in sent/overdue invoices
        $invoiceItemQ = InvoiceItem::with([
            'customer:id,first_name,last_name,customer_code,agent_id,client_id,vertical_type',
            'customer.agent:id,username,display_name',
            'customer.client:id,company_name,did_code',
            'invoice:id,client_id,status,invoice_date',
        ])->whereHas('invoice', fn ($q) => $q->whereIn('status', ['sent', 'overdue']));

        if ($startUtc) {
            $invoiceItemQ->whereHas('invoice', fn ($q) => $q->whereBetween('invoice_date', [
                Carbon::parse($startUtc)->toDateString(),
                Carbon::parse($endUtc)->toDateString(),
            ]));
        }
        $invoiceItems = $invoiceItemQ->get();

        $rows = $this->buildRevenueRows($type, $expectedAll, $confirmedAll, $invoiceItems);

        return response()->json([
            'success' => true,
            'type'    => $type,
            'period'  => $period,
            'rows'    => $rows,
        ]);
    }

    private function groupKey(string $type, $customer): string
    {
        return match ($type) {
            'client'   => 'c_' . ($customer->client_id  ?? 'none'),
            'agent'    => 'a_' . ($customer->agent_id   ?? 'none'),
            'vertical' => 'v_' . ($customer->vertical_type ?? 'N/A'),
            'customer' => 'cu_' . $customer->id,
            default    => 'none',
        };
    }

    private function groupLabel(string $type, $customer): array
    {
        return match ($type) {
            'client'   => [
                'label'    => $customer->client?->company_name ?? 'Unknown Client',
                'sublabel' => $customer->client?->did_code ?? '',
            ],
            'agent'    => [
                'label'    => $customer->agent?->display_name ?? 'Unknown Agent',
                'sublabel' => $customer->agent?->username ?? '',
            ],
            'vertical' => [
                'label'    => $customer->vertical_type ?? 'N/A',
                'sublabel' => '',
            ],
            'customer' => [
                'label'    => trim(($customer->first_name ?? '') . ' ' . ($customer->last_name ?? '')),
                'sublabel' => $customer->customer_code ?? '',
            ],
            default    => ['label' => 'Unknown', 'sublabel' => ''],
        };
    }

    private function buildRevenueRows(string $type, $expected, $confirmed, $invoiceItems): array
    {
        $map = [];

        foreach ($expected as $c) {
            $key = $this->groupKey($type, $c);
            if (!isset($map[$key])) {
                $map[$key] = array_merge($this->groupLabel($type, $c), ['expected' => 0, 'confirmed' => 0, 'invoice' => 0]);
            }
            $map[$key]['expected'] += (float) ($c->sale_rate_amount ?? 0);
        }

        foreach ($confirmed as $c) {
            $key = $this->groupKey($type, $c);
            if (!isset($map[$key])) {
                $map[$key] = array_merge($this->groupLabel($type, $c), ['expected' => 0, 'confirmed' => 0, 'invoice' => 0]);
            }
            $map[$key]['confirmed'] += (float) ($c->sale_rate_amount ?? 0);
        }

        foreach ($invoiceItems as $item) {
            $customer = $item->customer;
            if (!$customer) continue;
            $key = $this->groupKey($type, $customer);
            if (!isset($map[$key])) {
                $map[$key] = array_merge($this->groupLabel($type, $customer), ['expected' => 0, 'confirmed' => 0, 'invoice' => 0]);
            }
            $map[$key]['invoice'] += (float) ($item->amount ?? 0);
        }

        $rows = array_values($map);
        usort($rows, fn ($a, $b) => $b['confirmed'] <=> $a['confirmed']);
        return $rows;
    }

    // ── Customer Balances ─────────────────────────────────────────────────────
    // GET /api/admin/invoicing/customer-balances
    public function customerBalances(): JsonResponse
    {
        $this->adminOnly();

        $clients  = Client::where('is_active', true)->get();
        $balances = [];

        foreach ($clients as $client) {
            $confirmed = (float) Customer::where('client_id', $client->id)
                ->where('status', 'final_approved')
                ->sum('sale_rate_amount');

            $invoiced = (float) Invoice::where('client_id', $client->id)->sum('total_amount');

            $balance = max(0.0, $confirmed - $invoiced);

            if ($confirmed > 0 || $invoiced > 0) {
                $balances[] = [
                    'client_id'       => $client->id,
                    'company_name'    => $client->company_name,
                    'did_code'        => $client->did_code,
                    'total_confirmed' => $confirmed,
                    'total_invoiced'  => $invoiced,
                    'balance_due'     => $balance,
                ];
            }
        }

        usort($balances, fn ($a, $b) => $b['balance_due'] <=> $a['balance_due']);

        return response()->json(['success' => true, 'balances' => $balances]);
    }

    // ── Pending Invoices ──────────────────────────────────────────────────────
    // GET /api/admin/invoicing/pending-invoices
    public function pendingInvoices(): JsonResponse
    {
        $this->adminOnly();

        $today   = now()->setTimezone(self::TZ)->toDateString();
        $clients = Client::where('is_active', true)->get();
        $pending = [];

        foreach ($clients as $client) {
            $cycleDays  = max(1, (int) ($client->billing_cycle_days ?? 7));
            $startAfter = $client->billing_start_after ?? 'first_approved';

            // Find first qualifying sale date (PKT)
            if ($startAfter === 'first_approved') {
                $first = Customer::where('client_id', $client->id)
                    ->whereIn('status', ['approved', 'final_approved'])
                    ->whereNotNull('approved_at')
                    ->orderBy('approved_at')
                    ->first();
                $startDate = $first
                    ? Carbon::parse($first->approved_at)->setTimezone(self::TZ)->toDateString()
                    : null;
            } else {
                $first = Customer::where('client_id', $client->id)
                    ->where('status', 'final_approved')
                    ->whereNotNull('final_approved_at')
                    ->orderBy('final_approved_at')
                    ->first();
                $startDate = $first
                    ? Carbon::parse($first->final_approved_at)->setTimezone(self::TZ)->toDateString()
                    : null;
            }

            if (!$startDate) continue;

            // Walk through billing periods
            $cursor = Carbon::parse($startDate, self::TZ);
            for ($i = 0; $i < 200; $i++) {
                $periodStart = $cursor->toDateString();
                $periodEnd   = $cursor->copy()->addDays($cycleDays - 1)->toDateString();

                // Stop once we reach an open period
                if ($periodEnd >= $today) break;

                $hasInvoice = Invoice::where('client_id', $client->id)
                    ->where('billing_period_start', $periodStart)
                    ->where('billing_period_end', $periodEnd)
                    ->exists();

                if (!$hasInvoice) {
                    $startUtc = Carbon::parse($periodStart, self::TZ)->startOfDay()->utc();
                    $endUtc   = Carbon::parse($periodEnd,   self::TZ)->endOfDay()->utc();

                    $sales = Customer::where('client_id', $client->id)
                        ->where('status', 'final_approved')
                        ->whereBetween('final_approved_at', [$startUtc, $endUtc])
                        ->get();

                    if ($sales->count() > 0) {
                        $pending[] = [
                            'client_id'    => $client->id,
                            'company_name' => $client->company_name,
                            'did_code'     => $client->did_code,
                            'period_start' => $periodStart,
                            'period_end'   => $periodEnd,
                            'sales_count'  => $sales->count(),
                            'subtotal'     => $sales->sum(fn ($c) => (float) ($c->sale_rate_amount ?? 0)),
                            'cycle_days'   => $cycleDays,
                        ];
                    }
                }

                $cursor->addDays($cycleDays);
            }
        }

        return response()->json(['success' => true, 'pending' => $pending]);
    }

    // ── Create Invoice ────────────────────────────────────────────────────────
    // POST /api/admin/invoicing/create-invoice
    public function createInvoice(Request $request): JsonResponse
    {
        $this->adminOnly();

        $request->validate([
            'client_id'            => 'required|exists:clients,id',
            'period_start'         => 'required|date_format:Y-m-d',
            'period_end'           => 'required|date_format:Y-m-d|after_or_equal:period_start',
            'discount'             => 'nullable|numeric|min:0',
            'adjustment'           => 'nullable|numeric',
            'payment_receipt_date' => 'required|date_format:Y-m-d',
            'notes'                => 'nullable|string|max:1000',
        ]);

        // Prevent duplicate invoice for same client+period
        if (Invoice::where('client_id', $request->client_id)
            ->where('billing_period_start', $request->period_start)
            ->where('billing_period_end', $request->period_end)
            ->exists()
        ) {
            return response()->json(['message' => 'An invoice already exists for this billing period.'], 422);
        }

        $startUtc = Carbon::parse($request->period_start, self::TZ)->startOfDay()->utc();
        $endUtc   = Carbon::parse($request->period_end,   self::TZ)->endOfDay()->utc();

        $sales = Customer::where('client_id', $request->client_id)
            ->where('status', 'final_approved')
            ->whereBetween('final_approved_at', [$startUtc, $endUtc])
            ->get();

        if ($sales->isEmpty()) {
            return response()->json(['message' => 'No final-approved sales found in this period.'], 422);
        }

        $subtotal   = $sales->sum(fn ($c) => (float) ($c->sale_rate_amount ?? 0));
        $discount   = (float) ($request->discount   ?? 0);
        $adjustment = (float) ($request->adjustment ?? 0);
        $total      = $subtotal - $discount + $adjustment;

        $invoice = DB::transaction(function () use ($request, $subtotal, $discount, $adjustment, $total, $sales) {
            $year  = now()->setTimezone(self::TZ)->year;
            $count = Invoice::whereYear('created_at', $year)->lockForUpdate()->count() + 1;
            $num   = 'INV-' . $year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);

            $inv = Invoice::create([
                'invoice_number'       => $num,
                'client_id'            => $request->client_id,
                'billing_period_start' => $request->period_start,
                'billing_period_end'   => $request->period_end,
                'subtotal'             => $subtotal,
                'discount'             => $discount,
                'adjustment'           => $adjustment,
                'total_amount'         => $total,
                'status'               => 'pending',
                'invoice_date'         => now()->setTimezone(self::TZ)->toDateString(),
                'due_date'             => $request->payment_receipt_date,
                'notes'                => $request->notes,
                'created_by'           => auth()->id(),
            ]);

            foreach ($sales as $sale) {
                InvoiceItem::create([
                    'invoice_id'  => $inv->id,
                    'customer_id' => $sale->id,
                    'description' => trim(($sale->first_name ?? '') . ' ' . ($sale->last_name ?? ''))
                                   . ' — ' . ($sale->vertical_type ?? 'N/A'),
                    'rate'        => (float) ($sale->sale_rate_amount ?? 0),
                    'quantity'    => 1,
                    'amount'      => (float) ($sale->sale_rate_amount ?? 0),
                ]);
            }

            return $inv;
        });

        return response()->json([
            'success'        => true,
            'invoice_number' => $invoice->invoice_number,
            'total_amount'   => (float) $invoice->total_amount,
        ], 201);
    }

    // ── Invoice List ──────────────────────────────────────────────────────────
    // GET /api/admin/invoicing/invoices
    public function invoices(Request $request): JsonResponse
    {
        $this->adminOnly();

        // Auto-mark overdue
        Invoice::where('status', 'sent')
            ->where('due_date', '<', now()->setTimezone(self::TZ)->toDateString())
            ->update(['status' => 'overdue']);

        $query = Invoice::with(['client:id,company_name,did_code', 'creator:id,display_name'])
            ->withCount('items')
            ->orderByDesc('invoice_date')
            ->orderByDesc('id');

        $status = $request->input('status');
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        $period = $request->input('period', 'all');
        $now    = now()->setTimezone(self::TZ);
        [$startDate, $endDate] = match ($period) {
            'today'  => [$now->toDateString(), $now->toDateString()],
            'week'   => [$now->copy()->startOfWeek()->toDateString(), $now->copy()->endOfWeek()->toDateString()],
            'month'  => [$now->copy()->startOfMonth()->toDateString(), $now->copy()->endOfMonth()->toDateString()],
            'custom' => [$request->input('from_date'), $request->input('to_date')],
            default  => [null, null],
        };
        if ($startDate && $endDate) {
            $query->whereBetween('invoice_date', [$startDate, $endDate]);
        }

        $invoices = $query->get()->map(fn ($inv) => [
            'id'                    => $inv->id,
            'invoice_number'        => $inv->invoice_number,
            'company_name'          => $inv->client?->company_name,
            'did_code'              => $inv->client?->did_code,
            'billing_period_start'  => $inv->billing_period_start,
            'billing_period_end'    => $inv->billing_period_end,
            'subtotal'              => (float) $inv->subtotal,
            'discount'              => (float) $inv->discount,
            'adjustment'            => (float) $inv->adjustment,
            'total_amount'          => (float) $inv->total_amount,
            'status'                => $inv->status,
            'invoice_date'          => $inv->invoice_date,
            'due_date'              => $inv->due_date,
            'payment_received_date' => $inv->payment_received_date,
            'notes'                 => $inv->notes,
            'items_count'           => $inv->items_count,
            'created_by_name'       => $inv->creator?->display_name,
        ]);

        return response()->json(['success' => true, 'invoices' => $invoices]);
    }

    // ── Mark Sent ─────────────────────────────────────────────────────────────
    // POST /api/admin/invoicing/mark-sent/{invoice}
    public function markSent(Invoice $invoice): JsonResponse
    {
        $this->adminOnly();
        if ($invoice->status !== 'pending') {
            return response()->json(['message' => 'Only pending invoices can be marked as sent.'], 422);
        }
        $invoice->update(['status' => 'sent']);
        return response()->json(['success' => true, 'message' => 'Invoice marked as sent.']);
    }

    // ── Mark Received (Paid) ──────────────────────────────────────────────────
    // POST /api/admin/invoicing/mark-received/{invoice}
    public function markReceived(Request $request, Invoice $invoice): JsonResponse
    {
        $this->adminOnly();
        $request->validate([
            'payment_received_date' => 'required|date_format:Y-m-d',
        ]);
        if (!in_array($invoice->status, ['sent', 'overdue'], true)) {
            return response()->json(['message' => 'Only sent or overdue invoices can be marked as received.'], 422);
        }
        $invoice->update([
            'status'                => 'paid',
            'payment_received_date' => $request->payment_received_date,
        ]);
        return response()->json(['success' => true, 'message' => 'Payment marked as received.']);
    }
}
