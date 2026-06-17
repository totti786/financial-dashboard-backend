import { getDrizzleDb } from '../db/index.js';
import { rent, rentPayments } from '../db/schema.js';
import { eq, and, max, sql } from 'drizzle-orm';

const db = getDrizzleDb();

// ============================================================================
// Types
// ============================================================================

export interface MonthlyDetail {
  month: number;
  is_paid: boolean;
  is_sham_cash: boolean;
}

export interface RenteeData {
  id: number;
  rentee_name: string;
  rent_amount: number;
  monthly_payments: number[];
  monthly_details: MonthlyDetail[];
  sham_cash_payments: number[];
  row_number: number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get all rentees with their monthly payment details.
 *
 * Builds the denormalized response from the normalized rent_payments table:
 * - monthly_payments: 12-element array (1=paid, 0=unpaid)
 * - monthly_details: array of { month, is_paid, is_sham_cash }
 * - sham_cash_payments: 12-element array (1=sham_cash, 0=not)
 */
export function getRentData(): RenteeData[] {
  const rentees = db.select().from(rent).all();
  const allPayments = db.select().from(rentPayments).all();

  // Index payments by rent_id
  const paymentsByRentId = new Map<number, typeof allPayments>();
  for (const payment of allPayments) {
    const existing = paymentsByRentId.get(payment.rentId);
    if (existing) {
      existing.push(payment);
    } else {
      paymentsByRentId.set(payment.rentId, [payment]);
    }
  }

  const result: RenteeData[] = [];

  for (const rentee of rentees) {
    const payments = paymentsByRentId.get(rentee.id) ?? [];

    // Build 12-element arrays, defaulting to 0/false
    const monthlyPayments: number[] = new Array(12).fill(0);
    const shamCashPayments: number[] = new Array(12).fill(0);
    const monthlyDetails: MonthlyDetail[] = [];

    for (let m = 1; m <= 12; m++) {
      const payment = payments.find((p) => p.month === m);
      if (payment) {
        monthlyPayments[m - 1] = payment.isPaid;
        shamCashPayments[m - 1] = payment.isShamCash;
      }
      monthlyDetails.push({
        month: m,
        is_paid: payment ? payment.isPaid === 1 : false,
        is_sham_cash: payment ? payment.isShamCash === 1 : false,
      });
    }

    result.push({
      id: rentee.id,
      rentee_name: rentee.renteeName,
      rent_amount: rentee.rentAmount ?? 0,
      monthly_payments: monthlyPayments,
      monthly_details: monthlyDetails,
      sham_cash_payments: shamCashPayments,
      row_number: rentee.rowNumber ?? 0,
    });
  }

  // Sort by row_number
  result.sort((a, b) => a.row_number - b.row_number);

  return result;
}

/**
 * Add a new rentee with 12 unpaid monthly payment records.
 */
export function addRentee(
  renteeName: string,
  rentAmount?: number,
): { row_number: number; id: number } {
  // Determine next row_number
  const existing = db
    .select({ maxRow: max(rent.rowNumber) })
    .from(rent)
    .all();
  const maxRow = existing[0]?.maxRow ?? 0;
  const rowNumber = maxRow + 1;

  // Insert rentee
  const result = db
    .insert(rent)
    .values({
      renteeName,
      rentAmount: rentAmount ?? 0,
      rowNumber,
    })
    .run();

  const rentId = Number(result.lastInsertRowid);

  // Create 12 monthly payment records (all unpaid)
  const paymentValues = [];
  for (let month = 1; month <= 12; month++) {
    paymentValues.push({
      rentId,
      month,
      isPaid: 0,
      isShamCash: 0,
    });
  }
  db.insert(rentPayments).values(paymentValues).run();

  return { row_number: rowNumber, id: rentId };
}

/**
 * Update a rentee's name and/or rent amount.
 */
export function updateRentee(
  rowNumber: number,
  renteeName?: string,
  rentAmount?: number,
): void {
  const updateData: Record<string, unknown> = {};
  if (renteeName !== undefined) updateData.renteeName = renteeName;
  if (rentAmount !== undefined) updateData.rentAmount = rentAmount;
  updateData.updatedAt = sql`(datetime('now'))`;

  db.update(rent)
    .set(updateData)
    .where(eq(rent.rowNumber, rowNumber))
    .run();
}

/**
 * Update a specific month's payment status for a rentee.
 */
export function updateRentMonth(
  rowNumber: number,
  month: number,
  isPaid: boolean,
  isShamCash?: boolean,
): void {
  // Find the rentee by row_number
  const renteeRecord = db
    .select()
    .from(rent)
    .where(eq(rent.rowNumber, rowNumber))
    .all();

  if (renteeRecord.length === 0) {
    throw new Error(`Rentee with row_number ${rowNumber} not found`);
  }

  const rentId = renteeRecord[0].id;

  const updateData: Record<string, unknown> = {};
  updateData.isPaid = isPaid ? 1 : 0;
  if (isShamCash !== undefined) {
    updateData.isShamCash = isShamCash ? 1 : 0;
  }

  db.update(rentPayments)
    .set(updateData)
    .where(
      and(
        eq(rentPayments.rentId, rentId),
        eq(rentPayments.month, month),
      ),
    )
    .run();
}

/**
 * Delete a rentee and all associated payment records (cascade).
 */
export function deleteRentee(rowNumber: number): void {
  db.delete(rent)
    .where(eq(rent.rowNumber, rowNumber))
    .run();
}
