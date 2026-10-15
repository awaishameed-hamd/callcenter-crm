<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $user     = $request->user();
        $period   = $request->input('period', 'weekly');
        $fromDate = $request->input('from_date');
        $toDate   = $request->input('to_date');

        $base = $this->applyPeriod($this->scopedQuery($user), $period, $fromDate, $toDate);

        // ── Stat counts ───────────────────────────────────────────────────────
        $total    = (clone $base)->count();
        $approved = (clone $base)->whereIn('status', ['approved', 'final_approved'])->count();
        $pending  = (clone $base)->where('status', 'pending')->count();
        $rejected = (clone $base)->whereIn('status', ['disapproved', 'final_disapproved', 'agent_rejected'])->count();

        // ── Breakdowns for stat cards ─────────────────────────────────────────
        $approvedByManager  = (clone $base)->where('status', 'approved')->count();
        $approvedByDirector = (clone $base)->where('status', 'final_approved')->count();
        $pendingAtManager   = (clone $base)->where('status', 'pending')->count();
        $pendingAtDirector  = (clone $base)->where('status', 'approved')->count();
        $rejectedByAgent    = (clone $base)->where('status', 'agent_rejected')->count();
        $rejectedByManager  = (clone $base)->where('status', 'disapproved')->count();
        $rejectedByDirector = (clone $base)->where('status', 'final_disapproved')->count();

        $stats = [
            'total'              => $total,
            'approved'           => $approved,
            'pending'            => $pending,
            'rejected'           => $rejected,
            'approvedByManager'  => $approvedByManager,
            'approvedByDirector' => $approvedByDirector,
            'pendingAtManager'   => $pendingAtManager,
            'pendingAtDirector'  => $pendingAtDirector,
            'rejectedByAgent'    => $rejectedByAgent,
            'rejectedByManager'  => $rejectedByManager,
            'rejectedByDirector' => $rejectedByDirector,
        ];

        $approvalRate = [
            'rate'     => $total > 0 ? round($approved / $total * 100) : 0,
            'approved' => $approved,
            'pending'  => $pending,
            'rejected' => $rejected,
            'total'    => $total,
        ];

        // ── 7-day daily trend ─────────────────────────────────────────────────
        $trend = $this->getDailyTrend($user);

        // ── Hourly trend — today's shift 7 PM → 4 AM PKT ─────────────────────
        $hourlyTrend = $this->getHourlyTrend($user);

        // ── Leaderboard — top 5 by approvals ─────────────────────────────────
        $leaderboard = $this->getLeaderboard($period, $fromDate, $toDate);

        // ── Sale Type pie (CPA vs CPL) ────────────────────────────────────────
        $saleTypePie = $this->applyPeriod($this->scopedQuery($user), $period, $fromDate, $toDate)
            ->leftJoin('clients', 'customers.client_id', '=', 'clients.id')
            ->select(
                DB::raw("COALESCE(clients.sale_type, 'Unknown') as name"),
                DB::raw('COUNT(*) as value')
            )
            ->groupBy('clients.sale_type')
            ->orderByDesc('value')
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'value' => (int) $r->value]);

        // ── Sales by Client pie (top 6 + Other, approved only) ────────────────
        $clientData = $this->applyPeriod($this->scopedQuery($user), $period, $fromDate, $toDate)
            ->leftJoin('clients', 'customers.client_id', '=', 'clients.id')
            ->whereIn('customers.status', ['approved', 'final_approved'])
            ->select(
                DB::raw("COALESCE(clients.company_name, clients.display_name, clients.did_code, 'Unknown') as name"),
                DB::raw('COUNT(*) as value')
            )
            ->groupBy('clients.id', 'clients.company_name', 'clients.display_name', 'clients.did_code')
            ->orderByDesc('value')
            ->limit(7)
            ->get();

        $top6      = $clientData->take(6);
        $otherVal  = $clientData->skip(6)->sum('value');
        $clientPie = $top6->map(fn ($r) => ['name' => $r->name, 'value' => (int) $r->value])->toArray();
        if ($otherVal > 0) $clientPie[] = ['name' => 'Other', 'value' => (int) $otherVal];

        // ── Monthly trend — last 12 months ────────────────────────────────────
        $monthlyTrend = $this->getMonthlyTrend($user);

        // ── Cancellation reasons ──────────────────────────────────────────────
        // Use COALESCE so final_disapproved records without a reason also show
        // their final_note (e.g. "Rejected by Client" saved before this fix)
        $cancellationPie = $this->applyPeriod($this->scopedQuery($user), $period, $fromDate, $toDate)
            ->whereIn('status', ['disapproved', 'final_disapproved'])
            ->where(function ($q) {
                $q->where(fn ($q2) => $q2->whereNotNull('reason')->where('reason', '!=', ''))
                  ->orWhere(fn ($q2) => $q2->whereNotNull('final_note')->where('final_note', '!=', ''));
            })
            ->select(
                DB::raw("COALESCE(NULLIF(reason, ''), final_note) as name"),
                DB::raw('COUNT(*) as value')
            )
            ->groupBy(DB::raw("COALESCE(NULLIF(reason, ''), final_note)"))
            ->orderByDesc('value')
            ->limit(6)
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'value' => (int) $r->value]);

        // ── Vertical breakdown pie ────────────────────────────────────────────
        $verticalPie = $this->applyPeriod($this->scopedQuery($user), $period, $fromDate, $toDate)
            ->select(DB::raw("COALESCE(vertical_type, 'Other') as name"), DB::raw('COUNT(*) as value'))
            ->groupBy('vertical_type')
            ->orderByDesc('value')
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'value' => (int) $r->value]);

        return response()->json(compact(
            'stats',
            'approvalRate',
            'trend',
            'hourlyTrend',
            'leaderboard',
            'saleTypePie',
            'clientPie',
            'monthlyTrend',
            'cancellationPie',
            'verticalPie',
        ));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function scopedQuery($auth)
    {
        return match ($auth->role) {
            'agent' => Customer::where('agent_id', $auth->id),
            default => Customer::query(),
        };
    }

    private function applyPeriod($query, string $period, ?string $fromDate = null, ?string $toDate = null)
    {
        $tz = 'Asia/Karachi';

        if ($period === 'daily') {
            return $query->whereDate('customers.created_at', now($tz)->toDateString());
        }
        if ($period === 'weekly') {
            return $query->whereBetween('customers.created_at', [
                now($tz)->startOfWeek(),
                now($tz)->endOfWeek(),
            ]);
        }
        if ($period === 'monthly') {
            return $query->whereBetween('customers.created_at', [
                now($tz)->startOfMonth(),
                now($tz)->endOfMonth(),
            ]);
        }
        if ($period === 'custom' && $fromDate && $toDate) {
            return $query->whereBetween('customers.created_at', [
                Carbon::parse($fromDate, $tz)->startOfDay(),
                Carbon::parse($toDate, $tz)->endOfDay(),
            ]);
        }

        // Default: this week
        return $query->whereBetween('customers.created_at', [
            now($tz)->startOfWeek(),
            now($tz)->endOfWeek(),
        ]);
    }

    // ── Hourly trend — shift 7 PM to 4 AM PKT ────────────────────────────────

    private function getHourlyTrend($auth): array
    {
        $tz    = 'Asia/Karachi';
        $start = Carbon::today($tz)->setTime(19, 0); // 7 PM PKT today
        $end   = Carbon::today($tz)->addDay()->setTime(4, 0);  // 4 AM PKT next day

        $rows = $this->scopedQuery($auth)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('HOUR(created_at + INTERVAL 5 HOUR) as hr, status, COUNT(*) as cnt')
            ->groupByRaw('HOUR(created_at + INTERVAL 5 HOUR), status')
            ->get();

        $grouped = $rows->groupBy('hr');

        $hours = [
            19 => '7 PM', 20 => '8 PM', 21 => '9 PM', 22 => '10 PM', 23 => '11 PM',
             0 => '12 AM',  1 => '1 AM',  2 => '2 AM',  3 => '3 AM',  4 => '4 AM',
        ];

        $trend = [];
        foreach ($hours as $h => $label) {
            $dayRows = $grouped->get((string) $h, collect());

            $submissions = $approved = $rejected = $pending = 0;
            foreach ($dayRows as $row) {
                $submissions += $row->cnt;
                if (in_array($row->status, ['approved', 'final_approved']))
                    $approved += $row->cnt;
                elseif (in_array($row->status, ['disapproved', 'final_disapproved']))
                    $rejected += $row->cnt;
                else
                    $pending += $row->cnt;
            }

            $trend[] = compact('label', 'submissions', 'approved', 'rejected', 'pending');
        }

        return $trend;
    }

    // ── 7-day daily trend ─────────────────────────────────────────────────────

    private function getDailyTrend($auth): array
    {
        $start = Carbon::today('Asia/Karachi')->subDays(6)->startOfDay();
        $end   = Carbon::today('Asia/Karachi')->endOfDay();

        $rows = $this->scopedQuery($auth)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('DATE(created_at) as day, status, COUNT(*) as cnt')
            ->groupByRaw('DATE(created_at), status')
            ->get();

        $grouped = $rows->groupBy('day');

        $trend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date    = Carbon::today('Asia/Karachi')->subDays($i);
            $key     = $date->format('Y-m-d');
            $dayRows = $grouped->get($key, collect());

            $submissions = $approved = $rejected = $pending = 0;
            foreach ($dayRows as $row) {
                $submissions += $row->cnt;
                if (in_array($row->status, ['approved', 'final_approved']))
                    $approved += $row->cnt;
                elseif (in_array($row->status, ['disapproved', 'final_disapproved']))
                    $rejected += $row->cnt;
                else
                    $pending += $row->cnt;
            }

            $trend[] = [
                'date'        => $date->format('D'),
                'full'        => $date->format('M j'),
                'submissions' => $submissions,
                'approved'    => $approved,
                'rejected'    => $rejected,
                'pending'     => $pending,
            ];
        }

        return $trend;
    }

    // ── 12-month monthly trend ────────────────────────────────────────────────

    private function getMonthlyTrend($auth): array
    {
        $trend = [];
        for ($ago = 11; $ago >= 0; $ago--) {
            $d = now('Asia/Karachi')->subMonths($ago);
            $q = $this->scopedQuery($auth)
                ->whereYear('created_at', $d->year)
                ->whereMonth('created_at', $d->month);

            $trend[] = [
                'month'       => $d->format('M'),
                'submissions' => (clone $q)->count(),
                'approvals'   => (clone $q)->whereIn('status', ['approved', 'final_approved'])->count(),
            ];
        }
        return $trend;
    }

    // ── Top-5 leaderboard — by approvals ─────────────────────────────────────

    private function getLeaderboard(string $period, ?string $fromDate = null, ?string $toDate = null): array
    {
        $tz = 'Asia/Karachi';

        $q = DB::table('customers')
            ->join('users', 'customers.agent_id', '=', 'users.id')
            ->where('users.role', 'agent')
            ->select(
                'users.id',
                'users.display_name as name',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN customers.status IN ('approved','final_approved') THEN 1 ELSE 0 END) as approvals"),
                DB::raw("ROUND(SUM(CASE WHEN customers.status IN ('approved','final_approved') THEN 1 ELSE 0 END) / COUNT(*) * 100) as approval_rate")
            )
            ->groupBy('users.id', 'users.display_name')
            ->orderByDesc('approvals')
            ->limit(10);

        if ($period === 'daily') {
            $q->whereDate('customers.created_at', now($tz)->toDateString());
        } elseif ($period === 'monthly') {
            $q->whereBetween('customers.created_at', [now($tz)->startOfMonth(), now($tz)->endOfMonth()]);
        } elseif ($period === 'custom' && $fromDate && $toDate) {
            $q->whereBetween('customers.created_at', [
                Carbon::parse($fromDate, $tz)->startOfDay(),
                Carbon::parse($toDate, $tz)->endOfDay(),
            ]);
        } else {
            // weekly (default)
            $q->whereBetween('customers.created_at', [now($tz)->startOfWeek(), now($tz)->endOfWeek()]);
        }

        return $q->get()->map(fn ($r) => [
            'name'          => $r->name,
            'total'         => (int) $r->total,
            'approvals'     => (int) $r->approvals,
            'approval_rate' => (int) $r->approval_rate,
        ])->toArray();
    }
}
