// ============================================================================
// Drizzle ORM SQLite schema — 14 tables for the financial dashboard
// Compatible with Zod schemas in src/schemas/ and the old Python backend
// ============================================================================

import { sqliteTable, integer, text, real, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// Users — authentication & authorization
// ============================================================================
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  permission: text('permission').notNull().default('view'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  usernameIdx: index('idx_users_username').on(table.username),
}));

// ============================================================================
// Income — primary income records synced from Google Sheets
// ============================================================================
export const income = sqliteTable('income', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  description: text('description'),
  date: text('date'),
  rowNumber: integer('row_number').unique(),
  isSales: integer('is_sales').default(0),
  isShamCash: integer('is_sham_cash').default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  rowIdx: index('idx_income_row').on(table.rowNumber),
}));

// ============================================================================
// Expenses — expense records synced from Google Sheets
// ============================================================================
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  description: text('description'),
  date: text('date'),
  rowNumber: integer('row_number').unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  rowIdx: index('idx_expenses_row').on(table.rowNumber),
}));

// ============================================================================
// Debts — tracked debts with partial payment support
// ============================================================================
export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  originalAmount: real('original_amount').notNull(),
  description: text('description'),
  date: text('date'),
  rowNumber: integer('row_number'),
  paidAmount: real('paid_amount').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueIdentity: unique('unique_debt_identity').on(table.description, table.date, table.originalAmount),
  rowIdx: index('idx_debts_row').on(table.rowNumber),
}));

// ============================================================================
// Suppliers Outstanding — supplier debts (ABC columns in sheets)
// ============================================================================
export const suppliersOutstanding = sqliteTable('suppliers_outstanding', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierName: text('supplier_name').notNull(),
  amount: real('amount').notNull(),
  description: text('description'),
  date: text('date'),
  rowNumber: integer('row_number').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueSupplierRow: unique('unique_supplier_outstanding').on(table.supplierName, table.rowNumber),
  nameIdx: index('idx_suppliers_outstanding_name').on(table.supplierName),
  nameRowIdx: index('idx_suppliers_outstanding_row').on(table.supplierName, table.rowNumber),
}));

// ============================================================================
// Suppliers Paid — supplier payments (EFG columns in sheets)
// ============================================================================
export const suppliersPaid = sqliteTable('suppliers_paid', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierName: text('supplier_name').notNull(),
  amount: real('amount').notNull(),
  description: text('description'),
  date: text('date'),
  rowNumber: integer('row_number').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueSupplierRow: unique('unique_supplier_paid').on(table.supplierName, table.rowNumber),
  nameIdx: index('idx_suppliers_paid_name').on(table.supplierName),
  nameRowIdx: index('idx_suppliers_paid_row').on(table.supplierName, table.rowNumber),
}));

// ============================================================================
// Rent — rentees and their base rent information
// ============================================================================
export const rent = sqliteTable('rent', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  renteeName: text('rentee_name').notNull(),
  rentAmount: real('rent_amount').default(0),
  year: integer('year').notNull().default(2026),
  rowNumber: integer('row_number').unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  nameIdx: index('idx_rent_name').on(table.renteeName),
  rowIdx: index('idx_rent_row').on(table.rowNumber),
}));

// ============================================================================
// Rent Payments — normalized monthly payment status per rentee
// Normalizes the old month_1..month_12 + is_sham_cash columns into rows
// ============================================================================
export const rentPayments = sqliteTable('rent_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rentId: integer('rent_id').notNull().references(() => rent.id, { onDelete: 'cascade' }),
  month: integer('month').notNull(),
  isPaid: integer('is_paid').notNull().default(0),
  isShamCash: integer('is_sham_cash').notNull().default(0),
}, (table) => ({
  uniqueRentMonth: unique('unique_rent_month').on(table.rentId, table.month),
}));

// ============================================================================
// Warehouse Inventory — timber stock tracking
// ============================================================================
export const warehouseInventory = sqliteTable('warehouse_inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timberType: text('timber_type').notNull(),
  length: real('length').notNull(),
  width: real('width').notNull(),
  thickness: real('thickness').notNull(),
  numberOfBlanks: integer('number_of_blanks').notNull().default(1),
  volume: real('volume').notNull(),
  valuePerCubicMeter: real('value_per_cubic_meter'),
  totalValue: real('total_value'),
  grade: text('grade'),
  location: text('location'),
  notes: text('notes'),
  rowNumber: integer('row_number').unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  typeIdx: index('idx_warehouse_inventory_type').on(table.timberType),
  rowIdx: index('idx_warehouse_inventory_row').on(table.rowNumber),
}));

// ============================================================================
// Carpentry Income — carpentry business income records
// ============================================================================
export const carpentryIncome = sqliteTable('carpentry_income', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  month: integer('month'),
  year: integer('year'),
  rowNumber: integer('row_number').unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  dateIdx: index('idx_carpentry_income_date').on(table.year, table.month),
  rowIdx: index('idx_carpentry_income_row').on(table.rowNumber),
}));

// ============================================================================
// Carpentry Expenses — carpentry business expense records
// ============================================================================
export const carpentryExpenses = sqliteTable('carpentry_expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  month: integer('month'),
  year: integer('year'),
  isInternal: integer('is_internal').notNull().default(0),
  isFiras: integer('is_firas').notNull().default(0),
  rowNumber: integer('row_number').unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  dateIdx: index('idx_carpentry_expenses_date').on(table.year, table.month),
  rowIdx: index('idx_carpentry_expenses_row').on(table.rowNumber),
  internalIdx: index('idx_carpentry_expenses_internal').on(table.isInternal),
  firasIdx: index('idx_carpentry_expenses_firas').on(table.isFiras),
}));

// ============================================================================
// Monthly Sales — monthly sales targets aggregated from Google Sheets
// ============================================================================
export const monthlySales = sqliteTable('monthly_sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  year: integer('year').notNull(),
  monthNumber: integer('month_number').notNull(),
  monthName: text('month_name').notNull(),
  salesAmount: real('sales_amount').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueYearMonth: unique('unique_year_month').on(table.year, table.monthNumber),
}));

// ============================================================================
// Tracked Cells — specific cell values from Google Sheets (I12, K12, I18)
// ============================================================================
export const trackedCells = sqliteTable('tracked_cells', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cellReference: text('cell_reference').notNull().unique(),
  cellValue: real('cell_value').default(0),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  refIdx: index('idx_tracked_cells_ref').on(table.cellReference),
}));

// ============================================================================
// Audit Log — records all mutating operations for compliance
// ============================================================================
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  username: text('username'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  createdAtIdx: index('idx_audit_log_created').on(table.createdAt),
  entityIdx: index('idx_audit_log_entity').on(table.entityType, table.entityId),
  userIdx: index('idx_audit_log_user').on(table.username),
}));
