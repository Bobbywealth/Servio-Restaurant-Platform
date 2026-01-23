import { DatabaseService } from './DatabaseService';

type SelectionType = 'single' | 'multiple' | 'quantity';

interface SelectionOption {
  optionId: string;
  quantity?: number;
}

interface SelectionGroup {
  groupId: string;
  options: SelectionOption[];
}

interface ValidationError {
  code: string;
  message: string;
  groupId?: string;
  groupName?: string;
  reason?: string;
}

interface ValidationResult {
  valid: boolean;
  priceDeltaTotal?: number;
  snapshot?: any[];
  errors?: ValidationError[];
}

function normalizeInt(value: any, fallback: number | null = null): number | null {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return n;
}

function normalizeBool(value: any, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
}

export async function validateItemSelections(
  itemId: string,
  selections: SelectionGroup[]
): Promise<ValidationResult> {
  const db = DatabaseService.getInstance().getDatabase();

  // Load item-attached groups with options
  const rows = await db.all(
    `
    SELECT img.*, mg.name as group_name, mg.selection_type, mg.min_selections, mg.max_selections, mg.is_required,
           mg.is_active as group_active, mg.deleted_at as group_deleted,
           mo.id as option_id, mo.name as option_name, mo.price_delta, mo.is_active as option_active, mo.deleted_at as option_deleted
    FROM item_modifier_groups img
    INNER JOIN modifier_groups mg ON mg.id = img.group_id
    INNER JOIN modifier_options mo ON mo.group_id = mg.id
    WHERE img.item_id = ?
      AND img.deleted_at IS NULL
      AND mg.deleted_at IS NULL
      AND mo.deleted_at IS NULL
  `,
    [itemId]
  );

  if (!rows || rows.length === 0) {
    return { valid: true, priceDeltaTotal: 0, snapshot: [] };
  }

  // Rebuild structures
  const groups: Record<
    string,
    {
      id: string;
      name: string;
      selectionType: SelectionType;
      minSelections: number;
      maxSelections: number | null;
      isRequired: boolean;
      displayOrder: number;
      options: Record<
        string,
        { id: string; name: string; priceDelta: number; isActive: boolean }
      >;
    }
  > = {};

  for (const r of rows) {
    if (!groups[r.group_id]) {
      groups[r.group_id] = {
        id: r.group_id,
        name: r.group_name,
        selectionType: (r.selection_type as SelectionType) || 'single',
        minSelections: normalizeInt(r.override_min, r.min_selections) || 0,
        maxSelections:
          normalizeInt(r.override_max, r.max_selections === undefined ? null : r.max_selections) ??
          null,
        isRequired: normalizeBool(
          r.override_required,
          normalizeBool(r.is_required, false)
        ),
        displayOrder: normalizeInt(r.display_order, 0) || 0,
        options: {},
      };
    }
    const g = groups[r.group_id];
    g.options[r.option_id] = {
      id: r.option_id,
      name: r.option_name,
      priceDelta: Number(r.price_delta || 0),
      isActive: Boolean(r.option_active),
    };
  }

  const errors: ValidationError[] = [];
  let priceDeltaTotal = 0;
  const snapshot: any[] = [];

  const selectionMap: Record<string, SelectionGroup> = {};
  for (const s of selections || []) {
    if (s?.groupId) selectionMap[s.groupId] = s;
  }

  for (const g of Object.values(groups)) {
    const selection = selectionMap[g.id];
    const opts = selection?.options || [];
    let totalQty = 0;
    const snapOptions: any[] = [];

    for (const optSel of opts) {
      const opt = g.options[optSel.optionId];
      const qty = normalizeInt(optSel.quantity, 1) || 1;
      if (!opt || !opt.isActive) {
        errors.push({
          code: 'MODIFIER_INVALID_OPTION',
          message: `Invalid option`,
          groupId: g.id,
          groupName: g.name,
          reason: 'option_inactive_or_missing',
        });
        continue;
      }
      if (qty < 1) {
        errors.push({
          code: 'MODIFIER_INVALID_QUANTITY',
          message: `Quantity must be at least 1`,
          groupId: g.id,
          groupName: g.name,
          reason: 'quantity_lt_1',
        });
        continue;
      }
      totalQty += qty;
      priceDeltaTotal += opt.priceDelta * qty;
      snapOptions.push({
        optionId: opt.id,
        optionName: opt.name,
        priceDelta: opt.priceDelta,
        quantity: qty,
      });
    }

    const min = g.minSelections || 0;
    const max = g.maxSelections;

    switch (g.selectionType) {
      case 'single':
        if (g.isRequired && totalQty !== 1) {
          errors.push({
            code: 'MODIFIER_REQUIRED',
            message: `${g.name} requires exactly 1 selection`,
            groupId: g.id,
            groupName: g.name,
            reason: 'required_single',
          });
        } else if (!g.isRequired && totalQty > 1) {
          errors.push({
            code: 'MODIFIER_TOO_MANY',
            message: `${g.name} allows at most 1 selection`,
            groupId: g.id,
            groupName: g.name,
            reason: 'too_many_single',
          });
        }
        break;
      case 'multiple':
        if (g.isRequired && totalQty < Math.max(1, min)) {
          errors.push({
            code: 'MODIFIER_REQUIRED',
            message: `${g.name} requires at least ${Math.max(1, min)} selections`,
            groupId: g.id,
            groupName: g.name,
            reason: 'required_min',
          });
        }
        if (max !== null && totalQty > max) {
          errors.push({
            code: 'MODIFIER_TOO_MANY',
            message: `${g.name} allows at most ${max} selections`,
            groupId: g.id,
            groupName: g.name,
            reason: 'too_many',
          });
        }
        if (min > 0 && totalQty < min) {
          errors.push({
            code: 'MODIFIER_TOO_FEW',
            message: `${g.name} requires at least ${min} selections`,
            groupId: g.id,
            groupName: g.name,
            reason: 'too_few',
          });
        }
        break;
      case 'quantity':
        if (g.isRequired && totalQty < Math.max(1, min)) {
          errors.push({
            code: 'MODIFIER_REQUIRED',
            message: `${g.name} requires at least ${Math.max(1, min)} total quantity`,
            groupId: g.id,
            groupName: g.name,
            reason: 'required_min_qty',
          });
        }
        if (min > 0 && totalQty < min) {
          errors.push({
            code: 'MODIFIER_TOO_FEW',
            message: `${g.name} requires at least ${min} total quantity`,
            groupId: g.id,
            groupName: g.name,
            reason: 'too_few_qty',
          });
        }
        if (max !== null && totalQty > max) {
          errors.push({
            code: 'MODIFIER_TOO_MANY',
            message: `${g.name} allows at most ${max} total quantity`,
            groupId: g.id,
            groupName: g.name,
            reason: 'too_many_qty',
          });
        }
        break;
      default:
        break;
    }

    snapshot.push({
      groupId: g.id,
      groupName: g.name,
      selectionType: g.selectionType,
      isRequired: g.isRequired,
      minSelections: min,
      maxSelections: max,
      displayOrder: g.displayOrder,
      selections: snapOptions,
    });
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  return { valid: true, priceDeltaTotal, snapshot };
}
