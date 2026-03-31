import { Request, Response, Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { DatabaseService } from '../services/DatabaseService';

const router = Router();

type ChecklistTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  recurrence: 'daily' | 'weekly' | 'custom';
  recurrence_days: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ChecklistSectionRow = {
  id: string;
  template_id: string;
  name: string;
  emoji: string | null;
  sort_order: number;
  assigned_to: string | null;
  assigned_to_name: string | null;
};

type ChecklistItemRow = {
  id: string;
  section_id: string;
  text: string;
  sort_order: number;
  is_critical: boolean;
};

const asDateString = (value?: string) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }

  return value;
};

const dayOfWeek = (date: string) => {
  const utcDate = new Date(`${date}T00:00:00Z`);
  return utcDate.getUTCDay();
};

const buildTemplateGraph = async (restaurantId: string) => {
  const db = DatabaseService.getInstance().getDatabase();

  const templates = await db.all<ChecklistTemplateRow>(
    `SELECT id, name, description, recurrence, recurrence_days, is_active, created_at, updated_at
     FROM checklist_templates
     WHERE restaurant_id = ?
     ORDER BY created_at DESC`,
    [restaurantId]
  );

  const sections = await db.all<ChecklistSectionRow>(
    `SELECT s.id, s.template_id, s.name, s.emoji, s.sort_order, s.assigned_to, u.name AS assigned_to_name
     FROM checklist_sections s
     LEFT JOIN users u ON u.id = s.assigned_to
     INNER JOIN checklist_templates t ON t.id = s.template_id
     WHERE t.restaurant_id = ?
     ORDER BY s.sort_order ASC`,
    [restaurantId]
  );

  const items = await db.all<ChecklistItemRow>(
    `SELECT i.id, i.section_id, i.text, i.sort_order, i.is_critical
     FROM checklist_items i
     INNER JOIN checklist_sections s ON s.id = i.section_id
     INNER JOIN checklist_templates t ON t.id = s.template_id
     WHERE t.restaurant_id = ?
     ORDER BY i.sort_order ASC`,
    [restaurantId]
  );

  return templates.map((template) => {
    const templateSections = sections
      .filter((section) => section.template_id === template.id)
      .map((section) => ({
        ...section,
        items: items.filter((item) => item.section_id === section.id)
      }));

    return {
      ...template,
      sections: templateSections
    };
  });
};

const shouldRunOnDate = (recurrence: string, recurrenceDays: number[] | null, date: string) => {
  const dateDOW = dayOfWeek(date);
  const days = recurrenceDays && recurrenceDays.length > 0 ? recurrenceDays : [0, 1, 2, 3, 4, 5, 6];

  if (recurrence === 'daily') return true;
  if (recurrence === 'weekly' || recurrence === 'custom') {
    return days.includes(dateDOW);
  }

  return false;
};

const ensureInstancesForDate = async (restaurantId: string, date: string) => {
  const db = DatabaseService.getInstance().getDatabase();
  const activeTemplates = await db.all<ChecklistTemplateRow>(
    `SELECT id, name, description, recurrence, recurrence_days, is_active, created_at, updated_at
     FROM checklist_templates
     WHERE restaurant_id = ? AND is_active = TRUE`,
    [restaurantId]
  );

  for (const template of activeTemplates) {
    if (!shouldRunOnDate(template.recurrence, template.recurrence_days, date)) {
      continue;
    }

    const existing = await db.get<{ id: string }>(
      'SELECT id FROM checklist_instances WHERE template_id = ? AND date = ?',
      [template.id, date]
    );

    if (!existing) {
      await db.run(
        `INSERT INTO checklist_instances (id, template_id, restaurant_id, date, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [`checklist_instance_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, template.id, restaurantId, date]
      );
    }
  }
};

router.get('/templates', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const templates = await buildTemplateGraph(restaurantId!);

  res.json({
    success: true,
    data: { templates }
  });
}));

router.post('/templates', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId!;
  const { name, description, recurrence = 'daily', recurrenceDays = [0, 1, 2, 3, 4, 5, 6], sections = [] } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: { message: 'Template name is required' } });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const templateId = `checklist_template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db.run(
    `INSERT INTO checklist_templates (id, restaurant_id, name, description, recurrence, recurrence_days)
     VALUES (?, ?, ?, ?, ?, ?::integer[])`,
    [templateId, restaurantId, name, description || null, recurrence, recurrenceDays]
  );

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const sectionId = `checklist_section_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;

    await db.run(
      `INSERT INTO checklist_sections (id, template_id, name, emoji, sort_order, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sectionId, templateId, section.name, section.emoji || null, i, section.assignedTo || null]
    );

    const items = Array.isArray(section.items) ? section.items : [];
    for (let j = 0; j < items.length; j += 1) {
      const item = items[j];
      await db.run(
        `INSERT INTO checklist_items (id, section_id, text, sort_order, is_critical)
         VALUES (?, ?, ?, ?, ?)`,
        [`checklist_item_${Date.now()}_${i}_${j}_${Math.random().toString(36).slice(2, 8)}`, sectionId, item.text, j, !!item.isCritical]
      );
    }
  }

  res.status(201).json({
    success: true,
    data: { templateId }
  });
}));

router.put('/templates/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId!;
  const templateId = req.params.id;
  const { name, description, recurrence = 'daily', recurrenceDays = [0, 1, 2, 3, 4, 5, 6], isActive = true, sections = [] } = req.body;

  const db = DatabaseService.getInstance().getDatabase();

  const existing = await db.get<{ id: string }>(
    'SELECT id FROM checklist_templates WHERE id = ? AND restaurant_id = ?',
    [templateId, restaurantId]
  );

  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Template not found' } });
  }

  await db.run(
    `UPDATE checklist_templates
     SET name = ?, description = ?, recurrence = ?, recurrence_days = ?::integer[], is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, description || null, recurrence, recurrenceDays, isActive, templateId]
  );

  await db.run('DELETE FROM checklist_sections WHERE template_id = ?', [templateId]);

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const sectionId = `checklist_section_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;

    await db.run(
      `INSERT INTO checklist_sections (id, template_id, name, emoji, sort_order, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sectionId, templateId, section.name, section.emoji || null, i, section.assignedTo || null]
    );

    const items = Array.isArray(section.items) ? section.items : [];
    for (let j = 0; j < items.length; j += 1) {
      const item = items[j];
      await db.run(
        `INSERT INTO checklist_items (id, section_id, text, sort_order, is_critical)
         VALUES (?, ?, ?, ?, ?)`,
        [`checklist_item_${Date.now()}_${i}_${j}_${Math.random().toString(36).slice(2, 8)}`, sectionId, item.text, j, !!item.isCritical]
      );
    }
  }

  res.json({ success: true });
}));

router.delete('/templates/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId!;
  const templateId = req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  await db.run('DELETE FROM checklist_templates WHERE id = ? AND restaurant_id = ?', [templateId, restaurantId]);

  res.json({ success: true });
}));

router.get('/today', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId!;
  const date = asDateString(typeof req.query.date === 'string' ? req.query.date : undefined);

  await ensureInstancesForDate(restaurantId, date);

  const db = DatabaseService.getInstance().getDatabase();
  const rows = await db.all<any>(
    `SELECT
      ci.id AS instance_id,
      ci.status AS instance_status,
      ci.completed_at AS instance_completed_at,
      ci.date,
      ct.id AS template_id,
      ct.name AS template_name,
      cs.id AS section_id,
      cs.name AS section_name,
      cs.emoji AS section_emoji,
      cs.sort_order AS section_sort_order,
      cs.assigned_to AS section_assigned_to,
      assignee.name AS section_assigned_to_name,
      citem.id AS item_id,
      citem.text AS item_text,
      citem.sort_order AS item_sort_order,
      citem.is_critical,
      cc.id AS completion_id,
      cc.completed_by,
      completer.name AS completed_by_name,
      cc.completed_at
     FROM checklist_instances ci
     INNER JOIN checklist_templates ct ON ct.id = ci.template_id
     INNER JOIN checklist_sections cs ON cs.template_id = ct.id
     INNER JOIN checklist_items citem ON citem.section_id = cs.id
     LEFT JOIN checklist_completions cc ON cc.instance_id = ci.id AND cc.item_id = citem.id
     LEFT JOIN users completer ON completer.id = cc.completed_by
     LEFT JOIN users assignee ON assignee.id = cs.assigned_to
     WHERE ci.restaurant_id = ?
       AND ci.date = ?
     ORDER BY ct.name ASC, cs.sort_order ASC, citem.sort_order ASC`,
    [restaurantId, date]
  );

  const byInstance = new Map<string, any>();

  rows.forEach((row) => {
    if (!byInstance.has(row.instance_id)) {
      byInstance.set(row.instance_id, {
        id: row.instance_id,
        date: row.date,
        status: row.instance_status,
        completedAt: row.instance_completed_at,
        templateId: row.template_id,
        templateName: row.template_name,
        sections: [] as any[]
      });
    }

    const instance = byInstance.get(row.instance_id);
    let section = instance.sections.find((entry: any) => entry.id === row.section_id);
    if (!section) {
      section = {
        id: row.section_id,
        name: row.section_name,
        emoji: row.section_emoji,
        sortOrder: row.section_sort_order,
        assignedTo: row.section_assigned_to,
        assignedToName: row.section_assigned_to_name,
        items: [] as any[]
      };
      instance.sections.push(section);
    }

    section.items.push({
      id: row.item_id,
      text: row.item_text,
      sortOrder: row.item_sort_order,
      isCritical: row.is_critical,
      completion: row.completion_id
        ? {
            id: row.completion_id,
            completedBy: row.completed_by,
            completedByName: row.completed_by_name,
            completedAt: row.completed_at
          }
        : null
    });
  });

  const instances = Array.from(byInstance.values()).map((instance) => {
    const totalItems = instance.sections.reduce((count: number, section: any) => count + section.items.length, 0);
    const completedItems = instance.sections.reduce(
      (count: number, section: any) => count + section.items.filter((item: any) => item.completion).length,
      0
    );

    return {
      ...instance,
      progress: {
        completed: completedItems,
        total: totalItems,
        percent: totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100)
      }
    };
  });

  res.json({
    success: true,
    data: {
      date,
      instances
    }
  });
}));

router.post('/:instanceId/toggle/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId!;
  const userId = req.user?.id;
  const { instanceId, itemId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const instance = await db.get<{ id: string }>(
    'SELECT id FROM checklist_instances WHERE id = ? AND restaurant_id = ?',
    [instanceId, restaurantId]
  );

  if (!instance) {
    return res.status(404).json({ success: false, error: { message: 'Checklist instance not found' } });
  }

  const existing = await db.get<{ id: string }>(
    'SELECT id FROM checklist_completions WHERE instance_id = ? AND item_id = ?',
    [instanceId, itemId]
  );

  let checked = false;
  if (existing) {
    await db.run('DELETE FROM checklist_completions WHERE instance_id = ? AND item_id = ?', [instanceId, itemId]);
    checked = false;
  } else {
    await db.run(
      `INSERT INTO checklist_completions (id, instance_id, item_id, completed_by)
       VALUES (?, ?, ?, ?)`,
      [`checklist_completion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, instanceId, itemId, userId || null]
    );
    checked = true;
  }

  const progress = await db.get<{ total: string; completed: string }>(
    `SELECT
      COUNT(i.id)::text AS total,
      COUNT(c.id)::text AS completed
     FROM checklist_instances ci
     INNER JOIN checklist_templates t ON t.id = ci.template_id
     INNER JOIN checklist_sections s ON s.template_id = t.id
     INNER JOIN checklist_items i ON i.section_id = s.id
     LEFT JOIN checklist_completions c ON c.instance_id = ci.id AND c.item_id = i.id
     WHERE ci.id = ?`,
    [instanceId]
  );

  const total = Number(progress?.total || 0);
  const completed = Number(progress?.completed || 0);

  await db.run(
    `UPDATE checklist_instances
     SET status = ?, completed_at = ?
     WHERE id = ?`,
    [total > 0 && completed === total ? 'completed' : 'active', total > 0 && completed === total ? new Date().toISOString() : null, instanceId]
  );

  res.json({
    success: true,
    data: {
      checked,
      progress: {
        total,
        completed,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100)
      }
    }
  });
}));

router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId!;
  const from = typeof req.query.from === 'string' ? req.query.from : new Date(Date.now() - (7 * 86400000)).toISOString().slice(0, 10);
  const to = typeof req.query.to === 'string' ? req.query.to : new Date().toISOString().slice(0, 10);

  const db = DatabaseService.getInstance().getDatabase();
  const history = await db.all(
    `SELECT ci.id, ci.date, ci.status, ci.completed_at, ct.name AS template_name,
      COUNT(citem.id) AS total_items,
      COUNT(cc.id) AS completed_items
     FROM checklist_instances ci
     INNER JOIN checklist_templates ct ON ct.id = ci.template_id
     INNER JOIN checklist_sections cs ON cs.template_id = ct.id
     INNER JOIN checklist_items citem ON citem.section_id = cs.id
     LEFT JOIN checklist_completions cc ON cc.instance_id = ci.id AND cc.item_id = citem.id
     WHERE ci.restaurant_id = ?
       AND ci.date BETWEEN ? AND ?
     GROUP BY ci.id, ci.date, ci.status, ci.completed_at, ct.name
     ORDER BY ci.date DESC, ct.name ASC`,
    [restaurantId, from, to]
  );

  res.json({
    success: true,
    data: { history }
  });
}));

export default router;
