<?php

use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\WorkingDayController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\CrmController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\AccountingController;
use App\Http\Controllers\DimensionsController;
use App\Http\Controllers\InvoicingController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    // Profile
    Route::put('/profile',          [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'changePassword']);

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Clients
    Route::get('/clients/dropdown',               [ClientController::class, 'dropdown']);
    Route::get('/clients/available-dids',         [ClientController::class, 'availableDids']);
    Route::get('/clients',                        [ClientController::class, 'index']);
    Route::post('/clients',                       [ClientController::class, 'store']);
    Route::put('/clients/{client}',               [ClientController::class, 'update']);
    Route::patch('/clients/{client}',             [ClientController::class, 'update']);
    Route::post('/clients/{client}/toggle-active',[ClientController::class, 'toggleActive']);

    // Users
    Route::get('/users/next-code',            [UserController::class, 'nextCode']);
    Route::get('/users',                     [UserController::class, 'index']);
    Route::post('/users',                    [UserController::class, 'store']);
    Route::put('/users/{user}',              [UserController::class, 'update']);
    Route::patch('/users/{user}',            [UserController::class, 'update']);
    Route::delete('/users/{user}',           [UserController::class, 'destroy']);
    Route::post('/users/{user}/activate',   [UserController::class, 'activate']);
    Route::post('/users/{user}/toggle-lock', [UserController::class, 'toggleLock']);

    // Customers
    Route::get('/customers',                           [CustomerController::class, 'index']);
    Route::post('/customers',                          [CustomerController::class, 'store']);
    Route::put('/customers/{customer}',                [CustomerController::class, 'update']);
    Route::post('/customers/{customer}/approve',       [CustomerController::class, 'approve']);
    Route::post('/customers/{customer}/reject',        [CustomerController::class, 'reject']);
    Route::post('/customers/{customer}/final-approve',  [CustomerController::class, 'finalApprove']);
    Route::post('/customers/{customer}/final-reject',   [CustomerController::class, 'finalReject']);
    Route::delete('/customers/{customer}',              [CustomerController::class, 'destroy']);

    // Reports (manager / director / admin)
    Route::get('/reports',        [ReportsController::class, 'index']);
    Route::get('/reports/export', [ReportsController::class, 'export']);

    // ─── Working Days ────────────────────────────────────────────────────────
    Route::prefix('working-days')->group(function () {
        Route::get('/',                   [WorkingDayController::class, 'index']);
        Route::post('/setup',             [WorkingDayController::class, 'setup']);
        Route::get('/settings',           [WorkingDayController::class, 'getSettings']);
        Route::patch('/settings/{key}',   [WorkingDayController::class, 'updateSetting']);
        Route::patch('/{date}/login-time',[WorkingDayController::class, 'updateLoginTime']);
        Route::patch('/{date}',           [WorkingDayController::class, 'updateDay']);
    });
    // ─────────────────────────────────────────────────────────────────────────

    // ─── Attendance ──────────────────────────────────────────────────────────
    Route::prefix('attendance')->group(function () {
        Route::get('/my',                            [AttendanceController::class, 'myAttendance']);
        Route::get('/report/export',                 [AttendanceController::class, 'exportReport']);
        Route::get('/report',                        [AttendanceController::class, 'report']);
        Route::get('/approval',                      [AttendanceController::class, 'approvalList']);
        Route::get('/daily',                         [AttendanceController::class, 'daily']);
        Route::patch('/hr-edit',                     [AttendanceController::class, 'hrEdit']);
        Route::patch('/{attendance}/approve',        [AttendanceController::class, 'approve']);
        Route::patch('/{attendance}/reject',         [AttendanceController::class, 'reject']);
        Route::patch('/{attendance}/edit-time',      [AttendanceController::class, 'editTime']);
    });
    // ────────────────────────────────────────────────────────────────────────

    // ─── Invoicing & Payments (admin only) ──────────────────────────────────
    Route::prefix('admin/invoicing')->group(function () {
        Route::get('/revenue-report',              [InvoicingController::class, 'revenueReport']);
        Route::get('/customer-balances',           [InvoicingController::class, 'customerBalances']);
        Route::get('/pending-invoices',            [InvoicingController::class, 'pendingInvoices']);
        Route::post('/create-invoice',             [InvoicingController::class, 'createInvoice']);
        Route::get('/invoices',                    [InvoicingController::class, 'invoices']);
        Route::post('/mark-sent/{invoice}',        [InvoicingController::class, 'markSent']);
        Route::post('/mark-received/{invoice}',    [InvoicingController::class, 'markReceived']);
    });
    // ────────────────────────────────────────────────────────────────────────

    // ─── Accounting Module (Accountant only) ────────────────────────────────────
    Route::prefix('accounting')->group(function () {
        // Chart of Accounts
        Route::get('/accounts',                      [AccountingController::class, 'coaIndex']);
        Route::post('/accounts',                     [AccountingController::class, 'coaStore']);
        Route::put('/accounts/{account}',            [AccountingController::class, 'coaUpdate']);
        Route::get('/accounts/{account}/balance',    [AccountingController::class, 'coaBalance']);
        Route::post('/accounts/load-defaults',       [AccountingController::class, 'loadDefaultAccounts']);
        // CoA Classification Management
        Route::get('/classes',                       [AccountingController::class, 'classIndex']);
        Route::post('/classes',                      [AccountingController::class, 'classStore']);
        Route::put('/classes/{id}',                  [AccountingController::class, 'classUpdate']);
        Route::patch('/classes/{id}/toggle',         [AccountingController::class, 'classToggle']);
        Route::delete('/classes/{id}',               [AccountingController::class, 'classDelete']);
        // Parties
        Route::get('/parties',                       [AccountingController::class, 'partiesIndex']);
        Route::post('/parties',                      [AccountingController::class, 'partiesStore']);
        Route::put('/parties/{party}',               [AccountingController::class, 'partiesUpdate']);
        // Exchange Rates
        Route::get('/exchange-rates',                [AccountingController::class, 'ratesIndex']);
        Route::post('/exchange-rates',               [AccountingController::class, 'ratesStore']);
        Route::get('/exchange-rates/for-date',       [AccountingController::class, 'rateForDate']);
        // Vouchers (all transaction types)
        Route::get('/vouchers',                      [AccountingController::class, 'vouchersIndex']);
        Route::post('/vouchers',                     [AccountingController::class, 'vouchersStore']);
        Route::get('/vouchers/{voucher}',            [AccountingController::class, 'vouchersShow']);
        Route::post('/vouchers/{voucher}/reverse',   [AccountingController::class, 'vouchersReverse']);
        // GL & TB
        Route::get('/gl',                            [AccountingController::class, 'generalLedger']);
        Route::get('/tb',                            [AccountingController::class, 'trialBalance']);
        // Reports
        Route::get('/reports/pnl',                  [AccountingController::class, 'profitAndLoss']);
        Route::get('/reports/balance-sheet',         [AccountingController::class, 'balanceSheet']);
        Route::get('/reports/ar-ageing',             [AccountingController::class, 'arAgeing']);
        Route::get('/reports/cash-flow',             [AccountingController::class, 'cashFlow']);
        Route::get('/reports/budget-vs-actuals',     [AccountingController::class, 'budgetVsActuals']);
        Route::post('/budgets',                      [AccountingController::class, 'budgetStore']);
        // ─── Dimensions ──────────────────────────────────────────────────────────────
        Route::prefix('dimensions')->group(function () {
            // Locations
            Route::get('/locations',              [DimensionsController::class, 'locationsIndex']);
            Route::post('/locations',             [DimensionsController::class, 'locationsStore']);
            Route::put('/locations/{id}',         [DimensionsController::class, 'locationsUpdate']);
            Route::patch('/locations/{id}/toggle',[DimensionsController::class, 'locationsToggle']);
            Route::delete('/locations/{id}',      [DimensionsController::class, 'locationsDestroy']);
            // Cost Centres
            Route::get('/cost-centres',              [DimensionsController::class, 'costCentresIndex']);
            Route::post('/cost-centres',             [DimensionsController::class, 'costCentresStore']);
            Route::put('/cost-centres/{id}',         [DimensionsController::class, 'costCentresUpdate']);
            Route::patch('/cost-centres/{id}/toggle',[DimensionsController::class, 'costCentresToggle']);
            Route::delete('/cost-centres/{id}',      [DimensionsController::class, 'costCentresDestroy']);
            // Projects
            Route::get('/projects',              [DimensionsController::class, 'projectsIndex']);
            Route::post('/projects',             [DimensionsController::class, 'projectsStore']);
            Route::put('/projects/{id}',         [DimensionsController::class, 'projectsUpdate']);
            Route::patch('/projects/{id}/toggle',[DimensionsController::class, 'projectsToggle']);
            Route::delete('/projects/{id}',      [DimensionsController::class, 'projectsDestroy']);
        });
    });
    // ────────────────────────────────────────────────────────────────────────────

    // CRM Management (admin only)
    Route::get('/crm/form-fields/public',                      [CrmController::class, 'publicFormFields']);
    Route::get('/crm/form-fields',                             [CrmController::class, 'getFormFields']);
    Route::put('/crm/form-fields',                             [CrmController::class, 'updateFormFields']);
    Route::post('/crm/form-fields',                            [CrmController::class, 'createField']);
    Route::delete('/crm/form-fields/{formType}/{fieldKey}',    [CrmController::class, 'deleteField']);
    Route::put('/crm/users/{user}/role',                       [CrmController::class, 'updateUserRole']);

});
