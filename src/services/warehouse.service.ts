import { getDrizzleDb } from '../db/index.js';
import { warehouseInventory } from '../db/schema.js';
import { eq, max, sql } from 'drizzle-orm';

const db = getDrizzleDb();

// ============================================================================
// Types
// ============================================================================

export interface WarehouseItem {
  id: number;
  timber_type: string;
  length: number;
  width: number;
  thickness: number;
  number_of_blanks: number;
  volume: number;
  value_per_cubic_meter: number | null;
  total_value: number | null;
  grade: string | null;
  location: string | null;
  notes: string | null;
  row_number: number;
}

export interface AddWarehouseParams {
  timberType: string;
  length: number;
  width: number;
  thickness: number;
  numberOfBlanks?: number;
  valuePerCubicMeter?: number;
  grade?: string;
  location?: string;
  notes?: string;
}

export interface UpdateWarehouseParams {
  timberType?: string;
  length?: number;
  width?: number;
  thickness?: number;
  numberOfBlanks?: number;
  valuePerCubicMeter?: number;
  grade?: string;
  location?: string;
  notes?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate volume in cubic meters from dimensions in centimeters.
 *
 * Formula: (length * width * thickness * number_of_blanks) / 1,000,000
 *
 * All dimensions are in cm. Dividing by 1,000,000 converts cm³ to m³.
 */
function calculateVolume(
  length: number,
  width: number,
  thickness: number,
  numberOfBlanks: number,
): number {
  return (length * width * thickness * numberOfBlanks) / 1_000_000;
}

/**
 * Calculate total value from volume and value per cubic meter.
 */
function calculateTotalValue(
  volume: number,
  valuePerCubicMeter?: number | null,
): number | null {
  if (valuePerCubicMeter == null) return null;
  return volume * valuePerCubicMeter;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get all warehouse inventory items.
 */
export function getInventory(): WarehouseItem[] {
  const items = db.select().from(warehouseInventory).all();

  return items.map(mapRowToItem).sort((a, b) => a.row_number - b.row_number);
}

/**
 * Add a new warehouse inventory item.
 *
 * Calculates volume = (l * w * t * blanks) / 1,000,000
 * Calculates total_value = volume * value_per_cubic_meter
 */
export function addItem(params: AddWarehouseParams): { row_number: number; id: number } {
  const numberOfBlanks = params.numberOfBlanks ?? 1;
  const volume = calculateVolume(
    params.length,
    params.width,
    params.thickness,
    numberOfBlanks,
  );
  const totalValue = calculateTotalValue(volume, params.valuePerCubicMeter);

  // Determine next row_number
  const existing = db
    .select({ maxRow: max(warehouseInventory.rowNumber) })
    .from(warehouseInventory)
    .all();
  const maxRow = existing[0]?.maxRow ?? 0;
  const rowNumber = maxRow + 1;

  const result = db
    .insert(warehouseInventory)
    .values({
      timberType: params.timberType,
      length: params.length,
      width: params.width,
      thickness: params.thickness,
      numberOfBlanks,
      volume,
      valuePerCubicMeter: params.valuePerCubicMeter ?? null,
      totalValue,
      grade: params.grade ?? null,
      location: params.location ?? null,
      notes: params.notes ?? null,
      rowNumber,
    })
    .run();

  return { row_number: rowNumber, id: Number(result.lastInsertRowid) };
}

/**
 * Update a warehouse inventory item.
 *
 * Recalculates volume if any dimension or number_of_blanks changed.
 * Recalculates total_value if volume or value_per_cubic_meter changed.
 */
export function updateItem(
  rowNumber: number,
  params: UpdateWarehouseParams,
): void {
  // Fetch existing item to compute volume if dimensions change
  const existing = db
    .select()
    .from(warehouseInventory)
    .where(eq(warehouseInventory.rowNumber, rowNumber))
    .all();

  if (existing.length === 0) {
    throw new Error(`Warehouse item with row_number ${rowNumber} not found`);
  }

  const current = existing[0];

  const length = params.length ?? current.length;
  const width = params.width ?? current.width;
  const thickness = params.thickness ?? current.thickness;
  const numberOfBlanks = params.numberOfBlanks ?? current.numberOfBlanks;
  const valuePerCubicMeter =
    params.valuePerCubicMeter ?? current.valuePerCubicMeter;

  const volume = calculateVolume(length, width, thickness, numberOfBlanks);
  const totalValue = calculateTotalValue(volume, valuePerCubicMeter);

  const updateData: Record<string, unknown> = {
    volume,
    totalValue,
    updatedAt: sql`(datetime('now'))`,
  };

  if (params.timberType !== undefined) updateData.timberType = params.timberType;
  if (params.length !== undefined) updateData.length = params.length;
  if (params.width !== undefined) updateData.width = params.width;
  if (params.thickness !== undefined) updateData.thickness = params.thickness;
  if (params.numberOfBlanks !== undefined) updateData.numberOfBlanks = params.numberOfBlanks;
  if (params.valuePerCubicMeter !== undefined) updateData.valuePerCubicMeter = params.valuePerCubicMeter;
  if (params.grade !== undefined) updateData.grade = params.grade;
  if (params.location !== undefined) updateData.location = params.location;
  if (params.notes !== undefined) updateData.notes = params.notes;

  db.update(warehouseInventory)
    .set(updateData)
    .where(eq(warehouseInventory.rowNumber, rowNumber))
    .run();
}

/**
 * Delete a warehouse inventory item by row_number.
 */
export function deleteItem(rowNumber: number): void {
  db.delete(warehouseInventory)
    .where(eq(warehouseInventory.rowNumber, rowNumber))
    .run();
}

// ============================================================================
// Internal helpers
// ============================================================================

function mapRowToItem(
  row: typeof warehouseInventory.$inferSelect,
): WarehouseItem {
  return {
    id: row.id,
    timber_type: row.timberType,
    length: row.length,
    width: row.width,
    thickness: row.thickness,
    number_of_blanks: row.numberOfBlanks,
    volume: row.volume,
    value_per_cubic_meter: row.valuePerCubicMeter,
    total_value: row.totalValue,
    grade: row.grade,
    location: row.location,
    notes: row.notes,
    row_number: row.rowNumber ?? 0,
  };
}
