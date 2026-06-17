import { getDrizzleDb } from '../db/index.js';
import { suppliersOutstanding, suppliersPaid } from '../db/schema.js';
import { eq, and, max, sql } from 'drizzle-orm';

const db = getDrizzleDb();

// ============================================================================
// Constants — hardcoded supplier allowlist from the old Python backend
// ============================================================================

const SUPPLIER_ALLOWLIST = [
  'محمود رمضان',
  'سمير غبشة',
  'ابو يامن بطل',
  'تامر الخطيب',
  'حسان الجاجة',
];

// ============================================================================
// Types
// ============================================================================

export interface SupplierTransaction {
  amount: number;
  description: string;
  date: string;
}

export interface SupplierRecord {
  id: number;
  row_number: number;
  owed?: SupplierTransaction;
  paid?: SupplierTransaction;
}

export interface SupplierGroup {
  name: string;
  records: SupplierRecord[];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Return the hardcoded supplier allowlist.
 */
export function getSupplierAllowlist(): string[] {
  return [...SUPPLIER_ALLOWLIST];
}

/**
 * Get all suppliers grouped by supplier_name.
 *
 * Joins suppliers_outstanding and suppliers_paid by (supplier_name, row_number).
 * If both tables have a record for the same (supplier_name, row_number), they
 * are merged into a single record with both `owed` and `paid` sub-objects.
 */
export function getSuppliers(): SupplierGroup[] {
  const outstanding = db.select().from(suppliersOutstanding).all();
  const paid = db.select().from(suppliersPaid).all();

  // Index outstanding records by (supplierName|rowNumber)
  const outstandingByKey = new Map<string, typeof outstanding[0]>();
  for (const o of outstanding) {
    outstandingByKey.set(`${o.supplierName}|${o.rowNumber}`, o);
  }

  // Index paid records by (supplierName|rowNumber)
  const paidByKey = new Map<string, typeof paid[0]>();
  for (const p of paid) {
    paidByKey.set(`${p.supplierName}|${p.rowNumber}`, p);
  }

  // Collect all unique keys across both tables
  const allKeys = new Set([
    ...outstandingByKey.keys(),
    ...paidByKey.keys(),
  ]);

  // Group merged records by supplier_name
  const bySupplier = new Map<string, SupplierRecord[]>();

  for (const key of allKeys) {
    const pipeIdx = key.indexOf('|');
    const name = key.slice(0, pipeIdx);
    const rowNumber = Number(key.slice(pipeIdx + 1));

    const o = outstandingByKey.get(key);
    const p = paidByKey.get(key);

    const record: SupplierRecord = {
      id: o?.id ?? p?.id ?? 0,
      row_number: rowNumber,
    };

    if (o) {
      record.owed = {
        amount: o.amount,
        description: o.description ?? '',
        date: o.date ?? '',
      };
    }

    if (p) {
      record.paid = {
        amount: p.amount,
        description: p.description ?? '',
        date: p.date ?? '',
      };
    }

    const existing = bySupplier.get(name);
    if (existing) {
      existing.push(record);
    } else {
      bySupplier.set(name, [record]);
    }
  }

  // Convert to sorted array
  const suppliers: SupplierGroup[] = [];
  for (const [name, records] of bySupplier.entries()) {
    records.sort((a, b) => a.row_number - b.row_number);
    suppliers.push({ name, records });
  }
  suppliers.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return suppliers;
}

/**
 * Add a supplier transaction (owed or paid).
 *
 * @returns The new { row_number, id }
 */
export function addSupplier(
  supplierName: string,
  type: 'owed' | 'paid',
  amount: number,
  description: string,
  date: string,
): { row_number: number; id: number } {
  const table = type === 'owed' ? suppliersOutstanding : suppliersPaid;

  // Determine next row_number for this supplier in the relevant table
  const existing = db
    .select({ maxRow: max(table.rowNumber) })
    .from(table)
    .where(eq(table.supplierName, supplierName))
    .all();

  const maxRow = existing[0]?.maxRow ?? 0;
  const rowNumber = maxRow + 1;

  const result = db
    .insert(table)
    .values({
      supplierName,
      amount,
      description,
      date,
      rowNumber,
    })
    .run();

  return { row_number: rowNumber, id: Number(result.lastInsertRowid) };
}

/**
 * Update a supplier transaction by (supplier_name, row_number, transaction_type).
 */
export function updateSupplier(
  supplierName: string,
  rowNumber: number,
  transactionType: 'owed' | 'paid',
  amount: number,
  description: string,
  date: string,
): void {
  const table = transactionType === 'owed' ? suppliersOutstanding : suppliersPaid;

  db.update(table)
    .set({
      amount,
      description,
      date,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(
      and(
        eq(table.supplierName, supplierName),
        eq(table.rowNumber, rowNumber),
      ),
    )
    .run();
}

/**
 * Delete a supplier transaction by (supplier_name, row_number, transaction_type).
 */
export function deleteSupplier(
  supplierName: string,
  rowNumber: number,
  transactionType: 'owed' | 'paid',
): void {
  const table = transactionType === 'owed' ? suppliersOutstanding : suppliersPaid;

  db.delete(table)
    .where(
      and(
        eq(table.supplierName, supplierName),
        eq(table.rowNumber, rowNumber),
      ),
    )
    .run();
}
