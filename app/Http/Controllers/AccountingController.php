<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AccountingBudget;
use App\Models\AccountingParty;
use App\Models\ExchangeRate;
use App\Models\Voucher;
use App\Models\VoucherLine;
use App\Models\VoucherSequence;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountingController extends Controller
{
    // ── Auth Guard ─────────────────────────────────────────────────────────────

    private function requireAccountant(): void
    {
        $user = auth()->user();
        $ok = ($user->role === 'manager' && in_array($user->manager_type, ['Accountant'], true))
            || $user->role === 'admin';
        if (! $ok) abort(403, 'Accounting module access denied.');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CHART OF ACCOUNTS
    // ══════════════════════════════════════════════════════════════════════════

    public function coaIndex(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $q = Account::query();
        if ($search = $request->input('search')) {
            $q->where(fn ($s) => $s->where('account_code', 'like', "%$search%")
                ->orWhere('account_name', 'like', "%$search%"));
        }
        if ($type = $request->input('type')) $q->where('account_type', $type);
        if ($request->boolean('posting_only')) $q->where('is_posting', true);
        if ($request->has('active')) $q->where('is_active', $request->boolean('active'));

        $accounts = $q->orderBy('account_code')
            ->addSelect([
                'accounts.*',
                DB::raw('(SELECT COALESCE(SUM(vl.debit_pkr),0) FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id WHERE vl.account_id=accounts.id AND v.status="posted") as total_debit'),
                DB::raw('(SELECT COALESCE(SUM(vl.credit_pkr),0) FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id WHERE vl.account_id=accounts.id AND v.status="posted") as total_credit'),
            ])
            ->get()
            ->map(function ($acc) {
                $d = (float)($acc->total_debit ?? 0);
                $c = (float)($acc->total_credit ?? 0);
                $acc->balance = $acc->normal_balance === 'debit' ? $d - $c : $c - $d;
                unset($acc->total_debit, $acc->total_credit);
                return $acc;
            });
        return response()->json(['data' => $accounts]);
    }

    public function coaStore(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $data = $request->validate([
            'account_code' => 'required|string|max:20|unique:accounts,account_code',
            'account_name' => 'required|string|max:255',
            'level_1'      => 'required|string',
            'level_2'      => 'required|string',
            'level_3'      => 'required|string',
            'level_4'      => 'nullable|string',  // User's L3: Cost, Accumulated Depreciation
            'level_5'      => 'nullable|string',  // User's L4: Computer & IT Equipment, Building
            'account_type' => 'required|in:asset,liability,equity,revenue,expense',
            'currency'     => 'required|in:PKR,USD,GBP,EUR',
            'is_posting'   => 'boolean',
            'parent_id'    => 'nullable|exists:accounts,id',
            'description'  => 'nullable|string',
        ]);

        // Auto-set normal balance
        $data['normal_balance'] = in_array($data['account_type'], ['asset', 'expense']) ? 'debit' : 'credit';
        $data['is_active'] = true;

        // Notes Classification (L3/level_4) required for these Sub Classifications
        $notesRequired = ['Property, Plant & Equipment', 'Intangible Assets', 'Right of Use Assets', 'Investment Properties', 'Lease Liability', 'Concession Assets'];
        if (in_array($data['level_3'], $notesRequired) && empty($data['level_4'])) {
            return response()->json(['message' => 'Notes Classification is required for this Sub Classification.'], 422);
        }

        // Sub Notes Classification (L4/level_5) required only for PPE / Intangibles / Investment Properties
        $subNotesRequired = ['Property, Plant & Equipment', 'Intangible Assets', 'Investment Properties'];
        if (in_array($data['level_3'], $subNotesRequired) && empty($data['level_5'])) {
            return response()->json(['message' => 'Sub Notes Classification is required for PPE, Intangible Assets, and Investment Properties.'], 422);
        }

        $account = Account::create($data);
        return response()->json(['data' => $account], 201);
    }

    public function coaUpdate(Request $request, Account $account): JsonResponse
    {
        $this->requireAccountant();
        $data = $request->validate([
            'account_code' => "required|string|max:20|unique:accounts,account_code,{$account->id}",
            'account_name' => 'required|string|max:255',
            'level_1'      => 'required|string',
            'level_2'      => 'required|string',
            'level_3'      => 'required|string',
            'level_4'      => 'nullable|string',
            'level_5'      => 'nullable|string',
            'account_type' => 'required|in:asset,liability,equity,revenue,expense',
            'currency'     => 'required|in:PKR,USD,GBP,EUR',
            'is_posting'   => 'boolean',
            'is_active'    => 'boolean',
            'description'  => 'nullable|string',
        ]);

        $data['normal_balance'] = in_array($data['account_type'], ['asset', 'expense']) ? 'debit' : 'credit';
        $account->update($data);
        return response()->json(['data' => $account]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // COA CLASSIFICATIONS  (coa_classes table)
    // ══════════════════════════════════════════════════════════════════════════

    /** GET /accounting/classes — return all classification records (flat list) */
    public function classIndex(): JsonResponse
    {
        $this->requireAccountant();
        $rows = DB::table('coa_classes')->orderBy('level')->orderBy('id')->get();
        return response()->json(['data' => $rows]);
    }

    /** POST /accounting/classes */
    public function classStore(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $data = $request->validate([
            'level'        => 'required|integer|in:2,3,4,5',
            'name'         => 'required|string|max:255',
            'parent_id'    => 'nullable|integer|exists:coa_classes,id',
            'account_type' => 'nullable|string|in:asset,liability,equity,revenue,expense',
            'code_digit'   => 'nullable|integer|min:1|max:9',
        ]);
        $data['is_active'] = true;
        $id = DB::table('coa_classes')->insertGetId(array_merge($data, [
            'created_at' => now(), 'updated_at' => now(),
        ]));
        return response()->json(['data' => DB::table('coa_classes')->find($id)], 201);
    }

    /** PUT /accounting/classes/{id} — rename */
    public function classUpdate(Request $request, int $id): JsonResponse
    {
        $this->requireAccountant();
        $data = $request->validate([
            'name'         => 'required|string|max:255',
            'account_type' => 'nullable|string|in:asset,liability,equity,revenue,expense',
            'code_digit'   => 'nullable|integer|min:1|max:9',
        ]);
        DB::table('coa_classes')->where('id', $id)->update(array_merge($data, ['updated_at' => now()]));
        return response()->json(['data' => DB::table('coa_classes')->find($id)]);
    }

    /** PATCH /accounting/classes/{id}/toggle — enable/disable */
    public function classToggle(int $id): JsonResponse
    {
        $this->requireAccountant();
        $row = DB::table('coa_classes')->find($id);
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        DB::table('coa_classes')->where('id', $id)->update(['is_active' => !$row->is_active, 'updated_at' => now()]);
        return response()->json(['data' => DB::table('coa_classes')->find($id)]);
    }

    /**
     * DELETE /accounting/classes/{id}
     *
     * Checks this classification AND all its descendants — if any account
     * in the ledger uses any of them, deletion is blocked with a clear error.
     */
    public function classDelete(int $id): JsonResponse
    {
        $this->requireAccountant();

        $row = DB::table('coa_classes')->find($id);
        if (!$row) return response()->json(['message' => 'Classification not found.'], 404);

        // Collect this record + all descendants (children, grandchildren, …)
        $allIds     = $this->classDescendants($id);
        $allIds[]   = $id;
        $allClasses = DB::table('coa_classes')->whereIn('id', $allIds)->get();

        // Check every classification name at its corresponding account level
        foreach ($allClasses as $cls) {
            $col   = 'level_' . $cls->level;   // level_2 / level_3 / level_4 / level_5
            $count = DB::table('accounts')->where($col, $cls->name)->count();
            if ($count > 0) {
                return response()->json([
                    'message' => "Cannot delete \"{$cls->name}\" — {$count} account(s) in the ledger are using this classification. Reclassify those accounts first.",
                ], 422);
            }
        }

        // Safe — cascade handles children automatically
        DB::table('coa_classes')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted successfully.']);
    }

    /** Recursively collect all descendant IDs of a given classification. */
    private function classDescendants(int $parentId): array
    {
        $ids = [];
        $children = DB::table('coa_classes')->where('parent_id', $parentId)->pluck('id');
        foreach ($children as $childId) {
            $ids[] = $childId;
            foreach ($this->classDescendants($childId) as $grandchild) {
                $ids[] = $grandchild;
            }
        }
        return $ids;
    }

    // ══════════════════════════════════════════════════════════════════════════

    public function coaBalance(Account $account): JsonResponse
    {
        $this->requireAccountant();
        $lines = VoucherLine::where('account_id', $account->id)
            ->whereHas('voucher', fn ($q) => $q->where('status', 'posted'))
            ->selectRaw('SUM(debit_pkr) as total_debit, SUM(credit_pkr) as total_credit')
            ->first();

        $debit  = (float) ($lines->total_debit  ?? 0);
        $credit = (float) ($lines->total_credit ?? 0);
        $balance = $account->normal_balance === 'debit' ? $debit - $credit : $credit - $debit;

        return response()->json([
            'account_id'   => $account->id,
            'account_name' => $account->account_name,
            'currency'     => $account->currency,
            'balance'      => round($balance, 2),
            'total_debit'  => round($debit, 2),
            'total_credit' => round($credit, 2),
        ]);
    }

    public function loadDefaultAccounts(): JsonResponse
    {
        $this->requireAccountant();
        if (Account::count() > 0) {
            return response()->json(['message' => 'Chart of Accounts already has entries.'], 422);
        }

        $defaults = $this->defaultCoA();
        foreach ($defaults as $row) {
            Account::create($row);
        }
        return response()->json(['message' => count($defaults) . ' default accounts loaded.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PARTIES (Customers & Suppliers)
    // ══════════════════════════════════════════════════════════════════════════

    public function partiesIndex(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $q = AccountingParty::query();
        if ($search = $request->input('search')) {
            $q->where('name', 'like', "%$search%");
        }
        if ($type = $request->input('type')) $q->where('type', $type);
        if ($request->has('active')) $q->where('is_active', $request->boolean('active'));
        return response()->json(['data' => $q->orderBy('name')->get()]);
    }

    public function partiesStore(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $data = $request->validate([
            'name'       => 'required|string|max:255',
            'type'       => 'required|in:customer,supplier,both',
            'email'      => 'nullable|email',
            'phone'      => 'nullable|string|max:50',
            'address'    => 'nullable|string',
            'tax_number' => 'nullable|string|max:50',
        ]);
        return response()->json(['data' => AccountingParty::create($data)], 201);
    }

    public function partiesUpdate(Request $request, AccountingParty $party): JsonResponse
    {
        $this->requireAccountant();
        $data = $request->validate([
            'name'       => 'required|string|max:255',
            'type'       => 'required|in:customer,supplier,both',
            'email'      => 'nullable|email',
            'phone'      => 'nullable|string|max:50',
            'address'    => 'nullable|string',
            'tax_number' => 'nullable|string|max:50',
            'is_active'  => 'boolean',
        ]);
        $party->update($data);
        return response()->json(['data' => $party]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EXCHANGE RATES
    // ══════════════════════════════════════════════════════════════════════════

    public function ratesIndex(): JsonResponse
    {
        $this->requireAccountant();
        $rates = DB::table('exchange_rates')->orderByDesc('rate_date')->orderBy('currency')->get();
        return response()->json(['data' => $rates]);
    }

    public function ratesStore(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $data = $request->validate([
            'currency'  => 'required|string|max:10',
            'rate'      => 'required|numeric|min:0.000001',
            'rate_date' => 'required|date',
        ]);
        DB::table('exchange_rates')->updateOrInsert(
            ['currency' => $data['currency'], 'rate_date' => $data['rate_date']],
            ['rate' => $data['rate'], 'updated_at' => now(), 'created_at' => now()]
        );
        return response()->json(['message' => 'Rate saved.']);
    }

    public function rateForDate(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $currency = $request->input('currency', 'USD');
        $date     = $request->input('date', today()->toDateString());
        $rate = DB::table('exchange_rates')
            ->where('currency', $currency)
            ->where('rate_date', '<=', $date)
            ->orderByDesc('rate_date')
            ->value('rate');
        return response()->json(['rate' => $rate ?? 1]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // VOUCHERS — All transaction types
    // ══════════════════════════════════════════════════════════════════════════

    public function vouchersIndex(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $q = Voucher::with(['party', 'paymentAccount', 'creator'])
            ->withCount('lines');

        if ($type = $request->input('type')) $q->where('voucher_type', $type);
        if ($status = $request->input('status')) $q->where('status', $status);
        if ($from = $request->input('from')) $q->where('date', '>=', $from);
        if ($to = $request->input('to')) $q->where('date', '<=', $to);
        if ($party = $request->input('party_id')) $q->where('party_id', $party);

        $vouchers = $q->orderByDesc('date')->orderByDesc('id')
            ->paginate((int) $request->input('per_page', 50));

        return response()->json($vouchers);
    }

    public function vouchersShow(Voucher $voucher): JsonResponse
    {
        $this->requireAccountant();
        $voucher->load(['lines.account', 'lines.party', 'party', 'paymentAccount', 'creator', 'linkedVoucher']);
        return response()->json(['data' => $voucher]);
    }

    /**
     * Create a voucher for any transaction type.
     * The frontend sends the raw form data; this method builds the correct
     * double-entry lines, detects the voucher type, and posts atomically.
     */
    public function vouchersStore(Request $request): JsonResponse
    {
        $this->requireAccountant();

        $form = $request->input('form_type'); // expense | sales_receipt | invoice | bill | bank_deposit | cheque | journal

        $validated = $request->validate([
            'form_type'          => 'required|in:expense,sales_receipt,invoice,bill,bank_deposit,cheque,journal',
            'date'               => 'required|date',
            'memo'               => 'nullable|string',
            'currency'           => 'required|in:PKR,USD,GBP,EUR',
            'exchange_rate'      => 'nullable|numeric|min:0',
            'party_id'           => 'nullable|exists:accounting_parties,id',
            'payment_account_id' => 'nullable|exists:accounts,id',
            'payment_method'     => 'nullable|string',
            'reference_number'   => 'nullable|string|max:100',
            'lines'              => 'required|array|min:1',
            'lines.*.account_id' => 'required|exists:accounts,id',
            'lines.*.amount'     => 'required|numeric|min:0.01',
            'lines.*.description'=> 'nullable|string',
            'lines.*.is_billable'=> 'nullable|boolean',
            'lines.*.party_id'   => 'nullable|exists:accounting_parties,id',
            // Journal-specific
            'lines.*.debit'      => 'nullable|numeric|min:0',
            'lines.*.credit'     => 'nullable|numeric|min:0',
        ]);

        $year = Carbon::parse($validated['date'])->year;

        return DB::transaction(function () use ($validated, $form, $year, $request) {

            // ── Journal Entry — manual debit/credit ─────────────────────────
            if ($form === 'journal') {
                $lines = $validated['lines'];
                $totalDebit  = collect($lines)->sum(fn ($l) => (float) ($l['debit']  ?? 0));
                $totalCredit = collect($lines)->sum(fn ($l) => (float) ($l['credit'] ?? 0));

                if (abs($totalDebit - $totalCredit) > 0.01) {
                    return response()->json(['message' => 'Total Debits must equal Total Credits.'], 422);
                }
                if ($totalDebit == 0) {
                    return response()->json(['message' => 'At least one debit and one credit line required.'], 422);
                }

                $voucher = Voucher::create([
                    'voucher_number' => VoucherSequence::nextNumber('JV', $year),
                    'voucher_type'   => 'JV',
                    'date'           => $validated['date'],
                    'currency'       => $validated['currency'],
                    'exchange_rate'  => $validated['exchange_rate'] ?? 1,
                    'memo'           => $validated['memo'] ?? null,
                    'is_adjusting'   => false,
                    'status'         => 'posted',
                    'created_by'     => auth()->id(),
                ]);

                foreach ($lines as $l) {
                    VoucherLine::create([
                        'voucher_id'   => $voucher->id,
                        'account_id'   => $l['account_id'],
                        'debit_pkr'    => (float) ($l['debit']  ?? 0),
                        'credit_pkr'   => (float) ($l['credit'] ?? 0),
                        'description'  => $l['description'] ?? null,
                        'party_id'     => $l['party_id'] ?? null,
                        'is_billable'  => $l['is_billable'] ?? false,
                        'project'      => $l['project'] ?? null,
                        'currency'     => $validated['currency'],
                        'exchange_rate'=> $validated['exchange_rate'] ?? 1,
                    ]);
                }

                return response()->json(['data' => $voucher->load('lines.account')], 201);
            }

            // ── All other forms — auto double-entry ─────────────────────────
            $paymentAccount = Account::findOrFail($validated['payment_account_id']);
            $lines          = $validated['lines'];
            $total          = collect($lines)->sum(fn ($l) => (float) $l['amount']);

            // Detect voucher type
            $isReceipt = in_array($form, ['sales_receipt', 'bank_deposit']);
            $voucherType = match ($form) {
                'journal'      => 'JV',
                'invoice'      => 'INV',
                'bill'         => 'BILL',
                'cheque'       => 'CHQ',
                default        => Voucher::detectType($paymentAccount, $isReceipt),
            };

            $number = VoucherSequence::nextNumber($voucherType, $year);

            $voucher = Voucher::create([
                'voucher_number'     => $number,
                'voucher_type'       => $voucherType,
                'date'               => $validated['date'],
                'party_id'           => $validated['party_id'] ?? null,
                'payment_account_id' => $paymentAccount->id,
                'payment_method'     => $validated['payment_method'] ?? null,
                'reference_number'   => $validated['reference_number'] ?? null,
                'currency'           => $validated['currency'],
                'exchange_rate'      => $validated['exchange_rate'] ?? 1,
                'memo'               => $validated['memo'] ?? null,
                'status'             => 'posted',
                'created_by'         => auth()->id(),
            ]);

            // Build double entry lines based on form type
            if ($isReceipt || $form === 'bank_deposit') {
                // Debit payment account (money in), Credit income accounts
                $cashBackAmount  = (float) ($request->input('cash_back_amount', 0));
                $cashBackAccId   = $request->input('cash_back_account_id');
                $depositTotal    = $total - $cashBackAmount;

                VoucherLine::create([
                    'voucher_id'  => $voucher->id,
                    'account_id'  => $paymentAccount->id,
                    'debit_pkr'   => $depositTotal,
                    'credit_pkr'  => 0,
                    'description' => 'Deposit to ' . $paymentAccount->account_name,
                    'currency'    => $validated['currency'],
                    'exchange_rate' => $validated['exchange_rate'] ?? 1,
                ]);

                if ($cashBackAmount > 0 && $cashBackAccId) {
                    VoucherLine::create([
                        'voucher_id'  => $voucher->id,
                        'account_id'  => $cashBackAccId,
                        'debit_pkr'   => $cashBackAmount,
                        'credit_pkr'  => 0,
                        'description' => 'Cash back',
                        'currency'    => $validated['currency'],
                        'exchange_rate' => $validated['exchange_rate'] ?? 1,
                    ]);
                }

                foreach ($lines as $l) {
                    VoucherLine::create([
                        'voucher_id'  => $voucher->id,
                        'account_id'  => $l['account_id'],
                        'debit_pkr'   => 0,
                        'credit_pkr'  => (float) $l['amount'],
                        'description' => $l['description'] ?? null,
                        'party_id'    => $l['party_id'] ?? null,
                        'is_billable' => $l['is_billable'] ?? false,
                        'currency'    => $validated['currency'],
                        'exchange_rate' => $validated['exchange_rate'] ?? 1,
                    ]);
                }
            } elseif ($form === 'invoice') {
                // Debit AR, Credit revenue lines
                $arAccount = Account::where('level_3', 'Accounts Receivable')->where('is_posting', true)->first();
                if (! $arAccount) return response()->json(['message' => 'Accounts Receivable account not found in CoA.'], 422);

                VoucherLine::create([
                    'voucher_id'  => $voucher->id,
                    'account_id'  => $arAccount->id,
                    'debit_pkr'   => $total,
                    'credit_pkr'  => 0,
                    'description' => 'Invoice ' . $number,
                    'party_id'    => $validated['party_id'] ?? null,
                    'currency'    => $validated['currency'],
                    'exchange_rate' => $validated['exchange_rate'] ?? 1,
                ]);

                foreach ($lines as $l) {
                    VoucherLine::create([
                        'voucher_id'  => $voucher->id,
                        'account_id'  => $l['account_id'],
                        'debit_pkr'   => 0,
                        'credit_pkr'  => (float) $l['amount'],
                        'description' => $l['description'] ?? null,
                        'currency'    => $validated['currency'],
                        'exchange_rate' => $validated['exchange_rate'] ?? 1,
                    ]);
                }
            } elseif ($form === 'bill') {
                // Debit expense, Credit AP
                $apAccount = Account::where('level_3', 'Accounts Payable')->where('is_posting', true)->first();
                if (! $apAccount) return response()->json(['message' => 'Accounts Payable account not found in CoA.'], 422);

                foreach ($lines as $l) {
                    VoucherLine::create([
                        'voucher_id'  => $voucher->id,
                        'account_id'  => $l['account_id'],
                        'debit_pkr'   => (float) $l['amount'],
                        'credit_pkr'  => 0,
                        'description' => $l['description'] ?? null,
                        'is_billable' => $l['is_billable'] ?? false,
                        'currency'    => $validated['currency'],
                        'exchange_rate' => $validated['exchange_rate'] ?? 1,
                    ]);
                }

                VoucherLine::create([
                    'voucher_id'  => $voucher->id,
                    'account_id'  => $apAccount->id,
                    'debit_pkr'   => 0,
                    'credit_pkr'  => $total,
                    'description' => 'Bill payable',
                    'party_id'    => $validated['party_id'] ?? null,
                    'currency'    => $validated['currency'],
                    'exchange_rate' => $validated['exchange_rate'] ?? 1,
                ]);
            } else {
                // Expense or Cheque: Debit expense lines, Credit payment account
                foreach ($lines as $l) {
                    VoucherLine::create([
                        'voucher_id'  => $voucher->id,
                        'account_id'  => $l['account_id'],
                        'debit_pkr'   => (float) $l['amount'],
                        'credit_pkr'  => 0,
                        'description' => $l['description'] ?? null,
                        'is_billable' => $l['is_billable'] ?? false,
                        'party_id'    => $l['party_id'] ?? null,
                        'currency'    => $validated['currency'],
                        'exchange_rate' => $validated['exchange_rate'] ?? 1,
                    ]);
                }

                VoucherLine::create([
                    'voucher_id'  => $voucher->id,
                    'account_id'  => $paymentAccount->id,
                    'debit_pkr'   => 0,
                    'credit_pkr'  => $total,
                    'description' => 'Payment from ' . $paymentAccount->account_name,
                    'currency'    => $validated['currency'],
                    'exchange_rate' => $validated['exchange_rate'] ?? 1,
                ]);
            }

            return response()->json(['data' => $voucher->load('lines.account')], 201);
        });
    }

    /** Reverse a posted voucher — creates a mirror entry with new number */
    public function vouchersReverse(Voucher $voucher): JsonResponse
    {
        $this->requireAccountant();
        if ($voucher->status !== 'posted') {
            return response()->json(['message' => 'Only posted vouchers can be reversed.'], 422);
        }

        $year = now()->year;

        return DB::transaction(function () use ($voucher, $year) {
            $reversal = Voucher::create([
                'voucher_number'  => VoucherSequence::nextNumber('JV', $year),
                'voucher_type'    => 'JV',
                'date'            => today()->toDateString(),
                'memo'            => 'Reversal of ' . $voucher->voucher_number,
                'currency'        => $voucher->currency,
                'exchange_rate'   => $voucher->exchange_rate,
                'status'          => 'posted',
                'reversal_of_id'  => $voucher->id,
                'is_adjusting'    => true,
                'created_by'      => auth()->id(),
            ]);

            foreach ($voucher->lines as $line) {
                VoucherLine::create([
                    'voucher_id'   => $reversal->id,
                    'account_id'   => $line->account_id,
                    'debit_pkr'    => $line->credit_pkr,   // flip
                    'credit_pkr'   => $line->debit_pkr,    // flip
                    'description'  => 'Reversal: ' . $line->description,
                    'currency'     => $line->currency,
                    'exchange_rate'=> $line->exchange_rate,
                ]);
            }

            $voucher->update(['status' => 'reversed']);
            return response()->json(['data' => $reversal->load('lines')]);
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GENERAL LEDGER
    // ══════════════════════════════════════════════════════════════════════════

    public function generalLedger(Request $request): JsonResponse
    {
        $this->requireAccountant();

        $accountId = $request->input('account_id');
        $from      = $request->input('from');
        $to        = $request->input('to');
        $type      = $request->input('voucher_type');
        $perPage   = (int) $request->input('per_page', 100);

        // Opening balance up to $from date
        $openingBalance = 0;
        if ($accountId && $from) {
            $account = Account::find($accountId);
            $ob = DB::table('voucher_lines as vl')
                ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
                ->where('vl.account_id', $accountId)
                ->where('v.status', 'posted')
                ->where('v.date', '<', $from)
                ->selectRaw('SUM(vl.debit_pkr) as d, SUM(vl.credit_pkr) as c')
                ->first();
            $d = (float) ($ob->d ?? 0);
            $c = (float) ($ob->c ?? 0);
            $openingBalance = ($account && $account->normal_balance === 'debit') ? $d - $c : $c - $d;
        }

        $q = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->leftJoin('accounting_parties as p', 'vl.party_id', '=', 'p.id')
            ->leftJoin('accounts as pa', 'v.payment_account_id', '=', 'pa.id')
            ->where('v.status', 'posted')
            ->select([
                'vl.id', 'v.date', 'v.voucher_type', 'v.voucher_number',
                'v.reference_number', 'v.memo as voucher_memo',
                'a.account_code', 'a.account_name', 'a.normal_balance',
                'p.name as party_name',
                'vl.debit_pkr', 'vl.credit_pkr', 'vl.description',
                'vl.is_billable', 'vl.project',
                'pa.account_name as payment_account',
            ]);

        if ($accountId) $q->where('vl.account_id', $accountId);
        if ($from)      $q->where('v.date', '>=', $from);
        if ($to)        $q->where('v.date', '<=', $to);
        if ($type)      $q->where('v.voucher_type', $type);

        $q->orderBy('v.date')->orderBy('v.id')->orderBy('vl.id');

        $rows = $q->paginate($perPage);

        // Compute running balance
        $running = $openingBalance;
        $items = collect($rows->items())->map(function ($row) use (&$running) {
            $row = (array) $row;
            $nb  = $row['normal_balance'];
            $running += ($nb === 'debit')
                ? ((float) $row['debit_pkr'] - (float) $row['credit_pkr'])
                : ((float) $row['credit_pkr'] - (float) $row['debit_pkr']);
            $row['running_balance'] = round($running, 2);
            return $row;
        });

        return response()->json([
            'opening_balance' => round($openingBalance, 2),
            'data'            => $items,
            'meta'            => [
                'current_page' => $rows->currentPage(),
                'last_page'    => $rows->lastPage(),
                'total'        => $rows->total(),
            ],
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TRIAL BALANCE
    // ══════════════════════════════════════════════════════════════════════════

    public function trialBalance(Request $request): JsonResponse
    {
        $this->requireAccountant();

        $asOf      = $request->input('as_of', today()->toDateString());
        $fromDate  = $request->input('from');               // Opening period start
        $hideZero  = $request->boolean('hide_zero', false);

        // Totals for all posted lines up to as_of
        $totals = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->where('v.status', 'posted')
            ->where('v.date', '<=', $asOf)
            ->selectRaw('
                vl.account_id,
                SUM(CASE WHEN v.date < ? THEN vl.debit_pkr  ELSE 0 END) as ob_debit,
                SUM(CASE WHEN v.date < ? THEN vl.credit_pkr ELSE 0 END) as ob_credit,
                SUM(CASE WHEN v.date >= ? THEN vl.debit_pkr  ELSE 0 END) as act_debit,
                SUM(CASE WHEN v.date >= ? THEN vl.credit_pkr ELSE 0 END) as act_credit
            ', [$fromDate ?? $asOf, $fromDate ?? $asOf, $fromDate ?? $asOf, $fromDate ?? $asOf])
            ->groupBy('vl.account_id')
            ->get()
            ->keyBy('account_id');

        $accounts = Account::orderBy('account_code')->get();
        $rows = [];

        foreach ($accounts as $acc) {
            $t = $totals->get($acc->id);
            if (! $t && $hideZero) continue;

            $obD  = (float) ($t->ob_debit  ?? 0);
            $obC  = (float) ($t->ob_credit ?? 0);
            $actD = (float) ($t->act_debit  ?? 0);
            $actC = (float) ($t->act_credit ?? 0);

            // Closing balance
            $clD = $obD + $actD;
            $clC = $obC + $actC;

            if ($hideZero && abs($clD - $clC) < 0.01 && $clD == 0) continue;

            $rows[] = [
                'account_id'   => $acc->id,
                'account_code' => $acc->account_code,
                'account_name' => $acc->account_name,
                'level_1'      => $acc->level_1,
                'level_2'      => $acc->level_2,
                'level_3'      => $acc->level_3,
                'level_4'      => $acc->level_4,
                'normal_balance'=> $acc->normal_balance,
                'ob_debit'     => round($obD, 2),
                'ob_credit'    => round($obC, 2),
                'act_debit'    => round($actD, 2),
                'act_credit'   => round($actC, 2),
                'cl_debit'     => round($clD, 2),
                'cl_credit'    => round($clC, 2),
            ];
        }

        $totalClD = array_sum(array_column($rows, 'cl_debit'));
        $totalClC = array_sum(array_column($rows, 'cl_credit'));

        return response()->json([
            'rows'      => $rows,
            'balanced'  => abs($totalClD - $totalClC) < 0.01,
            'total_cl_debit'  => round($totalClD, 2),
            'total_cl_credit' => round($totalClC, 2),
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REPORTS
    // ══════════════════════════════════════════════════════════════════════════

    public function profitAndLoss(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $from    = $request->input('from', now()->startOfYear()->toDateString());
        $to      = $request->input('to', today()->toDateString());
        $cmpFrom = $request->input('cmp_from');
        $cmpTo   = $request->input('cmp_to');

        $current  = $this->pnlData($from, $to);
        $compare  = ($cmpFrom && $cmpTo) ? $this->pnlData($cmpFrom, $cmpTo) : null;

        return response()->json(['current' => $current, 'compare' => $compare]);
    }

    private function pnlData(string $from, string $to): array
    {
        $lines = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->where('v.status', 'posted')
            ->whereBetween('v.date', [$from, $to])
            ->whereIn('a.account_type', ['revenue', 'expense'])
            ->selectRaw('a.id, a.account_name, a.level_1, a.level_2, a.level_3, a.normal_balance,
                SUM(vl.debit_pkr) as total_debit, SUM(vl.credit_pkr) as total_credit')
            ->groupBy('a.id', 'a.account_name', 'a.level_1', 'a.level_2', 'a.level_3', 'a.normal_balance')
            ->orderBy('a.level_2')->orderBy('a.account_name')
            ->get();

        $revenue  = $lines->where('level_1', 'Revenue');
        $expenses = $lines->where('level_1', 'Expenses');

        $calcNet = fn ($items) => $items->sum(fn ($r) =>
            $r->normal_balance === 'credit'
                ? (float) $r->total_credit - (float) $r->total_debit
                : (float) $r->total_debit  - (float) $r->total_credit
        );

        $totalRevenue  = $calcNet($revenue);
        $totalExpense  = $calcNet($expenses);
        $netProfit     = $totalRevenue - $totalExpense;

        return [
            'from'           => $from,
            'to'             => $to,
            'revenue'        => $revenue->values(),
            'expenses'       => $expenses->values(),
            'total_revenue'  => round($totalRevenue, 2),
            'total_expense'  => round($totalExpense, 2),
            'net_profit'     => round($netProfit, 2),
        ];
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $asOf = $request->input('as_of', today()->toDateString());

        $balances = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->where('v.status', 'posted')
            ->where('v.date', '<=', $asOf)
            ->whereIn('a.account_type', ['asset', 'liability', 'equity'])
            ->selectRaw('a.id, a.account_code, a.account_name, a.level_1, a.level_2, a.level_3, a.level_4, a.normal_balance,
                SUM(vl.debit_pkr) as total_debit, SUM(vl.credit_pkr) as total_credit')
            ->groupBy('a.id', 'a.account_code', 'a.account_name', 'a.level_1', 'a.level_2', 'a.level_3', 'a.level_4', 'a.normal_balance')
            ->orderBy('a.account_code')
            ->get()
            ->map(function ($r) {
                $r->balance = $r->normal_balance === 'debit'
                    ? (float) $r->total_debit - (float) $r->total_credit
                    : (float) $r->total_credit - (float) $r->total_debit;
                return $r;
            });

        $assets      = $balances->where('level_1', 'Assets');
        $liabilities = $balances->where('level_1', 'Liabilities');
        $equity      = $balances->where('level_1', 'Equity');

        return response()->json([
            'as_of'             => $asOf,
            'assets'            => $assets->values(),
            'liabilities'       => $liabilities->values(),
            'equity'            => $equity->values(),
            'total_assets'      => round($assets->sum('balance'), 2),
            'total_liabilities' => round($liabilities->sum('balance'), 2),
            'total_equity'      => round($equity->sum('balance'), 2),
            'balanced'          => abs($assets->sum('balance') - ($liabilities->sum('balance') + $equity->sum('balance'))) < 0.01,
        ]);
    }

    public function arAgeing(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $asOf = $request->input('as_of', today()->toDateString());

        $invoices = Voucher::with('party')
            ->where('voucher_type', 'INV')
            ->where('status', 'posted')
            ->where('date', '<=', $asOf)
            ->get();

        $rows = $invoices->map(function ($inv) use ($asOf) {
            $total = $inv->lines->sum('credit_pkr');           // credited to income = invoice amount
            // Payments received against AR for this party
            $paid  = DB::table('voucher_lines as vl')
                ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
                ->join('accounts as a', 'vl.account_id', '=', 'a.id')
                ->where('v.status', 'posted')
                ->where('v.party_id', $inv->party_id)
                ->where('a.level_3', 'Accounts Receivable')
                ->where('vl.credit_pkr', '>', 0)
                ->sum('vl.credit_pkr');

            $outstanding = max(0, $total - $paid);
            $days        = Carbon::parse($inv->date)->diffInDays($asOf, false);

            return [
                'voucher_number' => $inv->voucher_number,
                'party'          => $inv->party?->name,
                'date'           => $inv->date->toDateString(),
                'total'          => round($total, 2),
                'outstanding'    => round($outstanding, 2),
                'days_overdue'   => $days,
                'bucket'         => $days <= 0 ? 'current'
                    : ($days <= 30 ? '1-30'
                    : ($days <= 60 ? '31-60'
                    : ($days <= 90 ? '61-90' : '91+'))),
            ];
        })->filter(fn ($r) => $r['outstanding'] > 0)->values();

        return response()->json(['as_of' => $asOf, 'rows' => $rows]);
    }

    public function cashFlow(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $from = $request->input('from', now()->startOfYear()->toDateString());
        $to   = $request->input('to', today()->toDateString());

        // Operating: Net Profit + adjustments for non-cash items
        $pnl      = $this->pnlData($from, $to);
        $netProfit = $pnl['net_profit'];

        // Depreciation (non-cash expense added back)
        $depreciation = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->where('v.status', 'posted')
            ->whereBetween('v.date', [$from, $to])
            ->where('a.level_2', 'Depreciation and Amortization')
            ->sum('vl.debit_pkr');

        // Change in AR
        $arChange = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->where('v.status', 'posted')
            ->whereBetween('v.date', [$from, $to])
            ->where('a.level_3', 'Accounts Receivable')
            ->selectRaw('SUM(debit_pkr) - SUM(credit_pkr) as net')
            ->value('net');

        // Change in AP
        $apChange = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->where('v.status', 'posted')
            ->whereBetween('v.date', [$from, $to])
            ->where('a.level_3', 'Accounts Payable')
            ->selectRaw('SUM(credit_pkr) - SUM(debit_pkr) as net')
            ->value('net');

        $operating = $netProfit + (float) $depreciation - (float) $arChange + (float) $apChange;

        return response()->json([
            'from'        => $from,
            'to'          => $to,
            'operating'   => [
                'net_profit'   => round($netProfit, 2),
                'depreciation' => round((float) $depreciation, 2),
                'ar_change'    => round(-(float) $arChange, 2),
                'ap_change'    => round((float) $apChange, 2),
                'total'        => round($operating, 2),
            ],
        ]);
    }

    public function budgetVsActuals(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $year  = (int) $request->input('year', now()->year);
        $month = $request->input('month');

        $actuals = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'vl.voucher_id', '=', 'v.id')
            ->join('accounts as a', 'vl.account_id', '=', 'a.id')
            ->where('v.status', 'posted')
            ->whereYear('v.date', $year)
            ->when($month, fn ($q) => $q->whereMonth('v.date', $month))
            ->whereIn('a.account_type', ['revenue', 'expense'])
            ->selectRaw('vl.account_id, SUM(vl.debit_pkr) as d, SUM(vl.credit_pkr) as c')
            ->groupBy('vl.account_id')
            ->get()->keyBy('account_id');

        $budgets = DB::table('accounting_budgets')
            ->where('fiscal_year', $year)
            ->when($month, fn ($q) => $q->where('month', $month))
            ->selectRaw('account_id, SUM(amount) as budget_amount')
            ->groupBy('account_id')
            ->get()->keyBy('account_id');

        $accounts = Account::whereIn('account_type', ['revenue', 'expense'])->orderBy('account_code')->get();

        $rows = $accounts->map(function ($acc) use ($actuals, $budgets) {
            $a = $actuals->get($acc->id);
            $b = $budgets->get($acc->id);
            $actual = $a
                ? (float) ($acc->normal_balance === 'debit' ? $a->d - $a->c : $a->c - $a->d)
                : 0;
            $budget   = (float) ($b->budget_amount ?? 0);
            $variance = $budget - $actual;
            return [
                'account_id'   => $acc->id,
                'account_code' => $acc->account_code,
                'account_name' => $acc->account_name,
                'level_2'      => $acc->level_2,
                'actual'       => round($actual, 2),
                'budget'       => round($budget, 2),
                'variance'     => round($variance, 2),
            ];
        })->filter(fn ($r) => $r['actual'] != 0 || $r['budget'] != 0)->values();

        return response()->json(['year' => $year, 'month' => $month, 'rows' => $rows]);
    }

    public function budgetStore(Request $request): JsonResponse
    {
        $this->requireAccountant();
        $rows = $request->validate([
            'rows'              => 'required|array',
            'rows.*.account_id' => 'required|exists:accounts,id',
            'rows.*.fiscal_year'=> 'required|integer',
            'rows.*.month'      => 'required|integer|min:1|max:12',
            'rows.*.amount'     => 'required|numeric|min:0',
        ])['rows'];

        foreach ($rows as $row) {
            DB::table('accounting_budgets')->updateOrInsert(
                ['account_id' => $row['account_id'], 'fiscal_year' => $row['fiscal_year'], 'month' => $row['month']],
                ['amount' => $row['amount'], 'updated_at' => now(), 'created_at' => now()]
            );
        }
        return response()->json(['message' => count($rows) . ' budget rows saved.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DEFAULT CHART OF ACCOUNTS TEMPLATE
    // ══════════════════════════════════════════════════════════════════════════

    private function defaultCoA(): array
    {
        $nb = fn (string $type) => in_array($type, ['asset', 'expense']) ? 'debit' : 'credit';
        $a  = fn ($code, $name, $l1, $l2, $l3, $type, $l4 = null) => [
            'account_code'   => $code,
            'account_name'   => $name,
            'level_1'        => $l1,
            'level_2'        => $l2,
            'level_3'        => $l3,
            'level_4'        => $l4,
            'account_type'   => $type,
            'normal_balance' => $nb($type),
            'currency'       => 'PKR',
            'is_posting'     => true,
            'is_active'      => true,
        ];

        return [
            // ── Assets ──────────────────────────────────────────────────────
            $a('100010001', 'Cash in Hand',                  'Assets', 'Current Assets', 'Cash and Cash Equivalents', 'asset'),
            $a('100010002', 'Petty Cash',                    'Assets', 'Current Assets', 'Cash and Cash Equivalents', 'asset'),
            $a('100020001', 'Main Bank Account - PKR',       'Assets', 'Current Assets', 'Bank Accounts',             'asset'),
            $a('100020002', 'Main Bank Account - USD',       'Assets', 'Current Assets', 'Bank Accounts',             'asset'),
            $a('100030001', 'Accounts Receivable',           'Assets', 'Current Assets', 'Accounts Receivable',       'asset'),
            $a('100040001', 'Prepaid Rent',                  'Assets', 'Current Assets', 'Prepaid Expenses',          'asset'),
            $a('100040002', 'Prepaid Insurance',             'Assets', 'Current Assets', 'Prepaid Expenses',          'asset'),
            $a('100050001', 'Other Current Assets',          'Assets', 'Current Assets', 'Other Current Assets',      'asset'),
            $a('150010001', 'Computer Equipment - Cost',     'Assets', 'Non-Current Assets', 'Property, Plant & Equipment', 'asset', 'Computers & IT Equipment'),
            $a('150010002', 'Computer Equipment - Acc. Dep.','Assets', 'Non-Current Assets', 'Property, Plant & Equipment', 'asset', 'Computers & IT Equipment'),
            $a('150020001', 'Furniture & Fixtures - Cost',   'Assets', 'Non-Current Assets', 'Property, Plant & Equipment', 'asset', 'Furniture & Fixtures'),
            $a('150020002', 'Furniture & Fixtures - Acc. Dep.','Assets','Non-Current Assets','Property, Plant & Equipment','asset','Furniture & Fixtures'),
            $a('160010001', 'CRM Software License',          'Assets', 'Non-Current Assets', 'Intangible Assets',    'asset', 'Software Licenses'),
            $a('160010002', 'Acc. Amortization - CRM',       'Assets', 'Non-Current Assets', 'Intangible Assets',    'asset', 'Software Licenses'),

            // ── Liabilities ─────────────────────────────────────────────────
            $a('200010001', 'Accounts Payable',              'Liabilities', 'Current Liabilities', 'Accounts Payable',      'liability'),
            $a('200020001', 'Salaries Payable',              'Liabilities', 'Current Liabilities', 'Accrued Liabilities',   'liability'),
            $a('200020002', 'Utilities Payable',             'Liabilities', 'Current Liabilities', 'Accrued Liabilities',   'liability'),
            $a('200030001', 'Short-term Loan',               'Liabilities', 'Current Liabilities', 'Short-term Loans',      'liability'),
            $a('200040001', 'Income Tax Payable',            'Liabilities', 'Current Liabilities', 'Tax Liabilities',       'liability'),
            $a('250010001', 'Long-term Bank Loan',           'Liabilities', 'Non-Current Liabilities', 'Long-term Loans',   'liability'),

            // ── Equity ──────────────────────────────────────────────────────
            $a('300010001', 'Share Capital',                 'Equity', 'Share Capital', 'Paid-up Capital',          'equity'),
            $a('300020001', 'Retained Earnings',             'Equity', 'Share Capital', 'Retained Earnings',        'equity'),
            $a('300030001', 'General Reserve',               'Equity', 'Reserves',      'General Reserve',          'equity'),

            // ── Revenue ─────────────────────────────────────────────────────
            $a('400010001', 'Call Center Services Income',   'Revenue', 'Operating Revenue', 'Services Income',     'revenue'),
            $a('400010002', 'Commission Income',             'Revenue', 'Operating Revenue', 'Commission Income',   'revenue'),
            $a('400020001', 'Interest Income',               'Revenue', 'Other Income',      'Interest Income',     'revenue'),
            $a('400020002', 'Exchange Gain',                 'Revenue', 'Other Income',      'Exchange Gain/Loss',  'revenue'),

            // ── Expenses ────────────────────────────────────────────────────
            $a('500010001', 'Direct Agent Costs',            'Expenses', 'Cost of Revenue',      'Direct Costs',              'expense'),
            $a('510010001', 'Salaries & Wages',              'Expenses', 'Operating Expenses',   'Salaries and Wages',        'expense'),
            $a('510010002', 'Overtime Allowances',           'Expenses', 'Operating Expenses',   'Salaries and Wages',        'expense'),
            $a('510020001', 'Office Rent',                   'Expenses', 'Operating Expenses',   'Rent',                      'expense'),
            $a('510030001', 'Electricity',                   'Expenses', 'Operating Expenses',   'Utilities',                 'expense'),
            $a('510030002', 'Internet & Connectivity',       'Expenses', 'Operating Expenses',   'Utilities',                 'expense'),
            $a('510040001', 'Telephone Charges',             'Expenses', 'Operating Expenses',   'Communications',            'expense'),
            $a('510040002', 'VoIP / Dialer Costs',          'Expenses', 'Operating Expenses',   'Communications',            'expense'),
            $a('510050001', 'Office Supplies',               'Expenses', 'Operating Expenses',   'Other Operating Expenses',  'expense'),
            $a('510050002', 'Travel & Conveyance',           'Expenses', 'Operating Expenses',   'Other Operating Expenses',  'expense'),
            $a('510050003', 'Repairs & Maintenance',         'Expenses', 'Operating Expenses',   'Other Operating Expenses',  'expense'),
            $a('520010001', 'Bank Interest Expense',         'Expenses', 'Finance Costs',        'Interest Expense',          'expense'),
            $a('520010002', 'Bank Service Charges',          'Expenses', 'Finance Costs',        'Bank Charges',              'expense'),
            $a('520010003', 'Exchange Loss',                 'Expenses', 'Finance Costs',        'Exchange Gain/Loss',        'expense'),
            $a('530010001', 'Depreciation - IT Equipment',   'Expenses', 'Depreciation and Amortization', 'Depreciation', 'expense', 'Computers & IT Equipment'),
            $a('530010002', 'Depreciation - Furniture',      'Expenses', 'Depreciation and Amortization', 'Depreciation', 'expense', 'Furniture & Fixtures'),
            $a('530020001', 'Amortization - Software',       'Expenses', 'Depreciation and Amortization', 'Amortization', 'expense', 'Software Licenses'),
            $a('540010001', 'Income Tax Expense',            'Expenses', 'Taxation',             'Taxation',                  'expense'),
        ];
    }
}
