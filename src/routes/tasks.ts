import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { eventBus } from '../events/bus';

const router = Router();
const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0));

/**
 * GET /api/tasks/today
 * Get today's tasks
 */
router.get('/today', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  let query = `
    SELECT id, title, description, status, priority, type, assigned_to, due_date, created_at, updated_at, completed_at FROM tasks
    WHERE (type = 'daily'
    OR (due_date IS NOT NULL AND due_date::date = CURRENT_DATE)
    OR (type = 'one_time' AND status != 'completed'))
    AND restaurant_id = ?
  `;
  const params: any[] = [restaurantId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

    query += ' ORDER BY CASE WHEN status = \'pending\' THEN 1 WHEN status = \'in_progress\' THEN 2 ELSE 3 END, created_at';

  const tasks = await db.all(query, params);

  res.json({
    success: true,
    data: tasks
  });
}));

/**
 * GET /api/tasks
 * Get all tasks with filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, type, assignedTo, priority } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  let query = 'SELECT t.id, t.restaurant_id, t.title, t.description, t.status, t.priority, t.type, t.assigned_to, t.due_date, t.created_at, t.updated_at, t.completed_at, u.name as assigned_to_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id';
  const params: any[] = [restaurantId];
  const conditions: string[] = ['t.restaurant_id = ?'];

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }

  if (type) {
    conditions.push('t.type = ?');
    params.push(type);
  }

  if (assignedTo) {
    conditions.push('t.assigned_to = ?');
    params.push(assignedTo);
  }

  if (priority) {
    conditions.push('t.priority = ?');
    params.push(priority);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY t.created_at DESC';

  const tasks = await db.all(query, params);

  res.json({
    success: true,
    data: { tasks }
  });
}));

/**
 * POST /api/tasks/:id/complete
 * Mark a task as completed
 */
router.post('/:id/complete', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const db = DatabaseService.getInstance().getDatabase();

  const task = await db.get('SELECT id, title, description, status, priority, type, assigned_to, due_date, created_at, updated_at, completed_at FROM tasks WHERE id = ? AND restaurant_id = ?', [id, req.user?.restaurantId]);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: { message: 'Task not found' }
    });
  }

  if (task.status === 'completed') {
    return res.status(400).json({
      success: false,
      error: { message: 'Task is already completed' }
    });
  }

  await db.run(
    'UPDATE tasks SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['completed', new Date().toISOString(), id]
  );

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'complete_task',
    'task',
    id,
    { taskTitle: task.title, taskType: task.type }
  );

  await eventBus.emit('task.completed', {
    restaurantId: req.user?.restaurantId!,
    type: 'task.completed',
    actor: { actorType: 'user', actorId: req.user?.id },
    payload: { taskId: id, title: task.title },
    occurredAt: new Date().toISOString()
  });

  logger.info(`Task completed: ${task.title}`);

  res.json({
    success: true,
    data: {
      taskId: id,
      title: task.title,
      previousStatus: task.status,
      newStatus: 'completed',
      completedAt: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/tasks/:id/start
 * Mark a task as in progress
 */
router.post('/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const db = DatabaseService.getInstance().getDatabase();

  const task = await db.get('SELECT id, title, description, status, priority, type, assigned_to, due_date, created_at, updated_at, completed_at FROM tasks WHERE id = ? AND restaurant_id = ?', [id, req.user?.restaurantId]);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: { message: 'Task not found' }
    });
  }

  if (task.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: { message: 'Task must be pending to start' }
    });
  }

  await db.run(
    'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['in_progress', id]
  );

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'start_task',
    'task',
    id,
    { taskTitle: task.title }
  );

  logger.info(`Task started: ${task.title}`);

  res.json({
    success: true,
    data: {
      taskId: id,
      title: task.title,
      previousStatus: task.status,
      newStatus: 'in_progress'
    }
  });
}));

/**
 * GET /api/tasks/staff
 * Get all active staff members for the restaurant
 */
router.get('/staff', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const staff = await db.all(
    `SELECT id, name, email, role, permissions, is_active, created_at
     FROM users
     WHERE restaurant_id = ? AND is_active = TRUE
     ORDER BY name ASC`,
    [restaurantId]
  );

  res.json({
    success: true,
    data: { staff }
  });
}));

/**
 * GET /api/tasks/stats
 * Get task statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  const restaurantId = req.user?.restaurantId;

  const completedTodayCondition = "status = 'completed' AND completed_at::date = CURRENT_DATE";

  const [
    totalTasks,
    pendingTasks,
    completedToday,
    tasksByType,
    tasksByStatus
  ] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM tasks WHERE restaurant_id = ?', [restaurantId]),
    db.get('SELECT COUNT(*) as count FROM tasks WHERE status = \'pending\' AND restaurant_id = ?', [restaurantId]),
    db.get(`SELECT COUNT(*) as count FROM tasks WHERE ${completedTodayCondition} AND restaurant_id = ?`, [restaurantId]),
    db.all('SELECT type, COUNT(*) as count FROM tasks WHERE restaurant_id = ? GROUP BY type', [restaurantId]),
    db.all('SELECT status, COUNT(*) as count FROM tasks WHERE restaurant_id = ? GROUP BY status', [restaurantId])
  ]);

  const stats = {
    total: num(totalTasks.count),
    pending: num(pendingTasks.count),
    completedToday: num(completedToday.count),
    byType: tasksByType.reduce((acc: any, row: any) => {
      acc[row.type] = num(row.count);
      return acc;
    }, {}),
    byStatus: tasksByStatus.reduce((acc: any, row: any) => {
      acc[row.status] = num(row.count);
      return acc;
    }, {})
  };

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { title, description, type = 'one_time', assignedTo, dueDate, priority = 'medium', status = 'pending' } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      error: { message: 'Task title is required' }
    });
  }

  const validTypes = ['daily', 'weekly', 'monthly', 'one_time'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid task type. Must be one of: ' + validTypes.join(', ') }
    });
  }

  const validPriorities = ['low', 'medium', 'high'];
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid priority. Must be one of: ' + validPriorities.join(', ') }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.run(`
    INSERT INTO tasks (
      id, restaurant_id, title, description, type, assigned_to, due_date, status, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    taskId,
    req.user?.restaurantId,
    title,
    description || null,
    type,
    assignedTo || null,
    dueDate || null,
    status,
    priority
  ]);

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'create_task',
    'task',
    taskId,
    { title, type, assignedTo, priority }
  );

  await eventBus.emit('task.created', {
    restaurantId: req.user?.restaurantId!,
    type: 'task.created',
    actor: { actorType: 'user', actorId: req.user?.id },
    payload: { taskId, title, assignedTo, priority },
    occurredAt: new Date().toISOString()
  });

  logger.info(`New task created: ${title}`);

  res.status(201).json({
    success: true,
    data: {
      taskId,
      title,
      type,
      status,
      priority,
      createdAt: new Date().toISOString()
    }
  });
}));

/**
 * PUT /api/tasks/:id
 * Update a task
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, description, status, priority, assignedTo, dueDate } = req.body;

  const db = DatabaseService.getInstance().getDatabase();

  const task = await db.get('SELECT id, title, description, status, priority, type, assigned_to, due_date, created_at, updated_at, completed_at FROM tasks WHERE id = ? AND restaurant_id = ?', [id, req.user?.restaurantId]);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: { message: 'Task not found' }
    });
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }

  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }

  if (status !== undefined) {
    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') }
      });
    }
    updates.push('status = ?');
    params.push(status);

    if (status === 'completed') {
      updates.push('completed_at = ?');
      params.push(new Date().toISOString());
    }
  }

  if (priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid priority. Must be one of: ' + validPriorities.join(', ') }
      });
    }
    updates.push('priority = ?');
    params.push(priority);
  }

  if (assignedTo !== undefined) {
    updates.push('assigned_to = ?');
    params.push(assignedTo);
  }

  if (dueDate !== undefined) {
    updates.push('due_date = ?');
    params.push(dueDate);
  }

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'No fields to update' }
    });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await db.run(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'update_task',
    'task',
    id,
    { taskTitle: task.title, updates: req.body }
  );

  logger.info(`Task updated: ${task.title}`);

  res.json({
    success: true,
    data: {
      taskId: id,
      message: 'Task updated successfully'
    }
  });
}));

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const db = DatabaseService.getInstance().getDatabase();

  const task = await db.get('SELECT id, title, description, status, priority, type, assigned_to, due_date, created_at, updated_at, completed_at FROM tasks WHERE id = ? AND restaurant_id = ?', [id, req.user?.restaurantId]);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: { message: 'Task not found' }
    });
  }

  await db.run('DELETE FROM tasks WHERE id = ?', [id]);

  await DatabaseService.getInstance().logAudit(
    req.user?.restaurantId!,
    req.user?.id || 'system',
    'delete_task',
    'task',
    id,
    { taskTitle: task.title }
  );

  await eventBus.emit('task.deleted', {
    restaurantId: req.user?.restaurantId!,
    type: 'task.deleted',
    actor: { actorType: 'user', actorId: req.user?.id },
    payload: { taskId: id, title: task.title },
    occurredAt: new Date().toISOString()
  });

  logger.info(`Task deleted: ${task.title}`);

  res.json({
    success: true,
    data: {
      taskId: id,
      message: 'Task deleted successfully'
    }
  });
}));

/**
 * POST /api/tasks/generate-from-text
 * Generate tasks from text using AI
 */
router.post('/generate-from-text', asyncHandler(async (req: Request, res: Response) => {
  const { text, options } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Text content is required' }
    });
  }

  if (text.length < 10) {
    return res.status(400).json({
      success: false,
      error: { message: 'Text content is too short. Please provide at least 10 characters.' }
    });
  }

  if (text.length > 50000) {
    return res.status(400).json({
      success: false,
      error: { message: 'Text content is too long. Maximum 50,000 characters allowed.' }
    });
  }

  try {
    const { MiniMaxService } = await import('../services/MiniMaxService');
    const miniMax = new MiniMaxService();

    const maxTasks = Math.min(Math.max(options?.maxTasks || 10, 1), 50);

    const prompt = `Analyze the following text and extract all actionable tasks. For each task, provide:
- Task title (clear, concise action item, max 100 characters)
- Task description (additional context or details, max 500 characters)
- Suggested priority (high/medium/low based on urgency and importance)
- Suggested assignee name (if mentioned in text, otherwise leave empty)

Text to analyze:
${text}

Return ONLY a valid JSON array with this structure:
[
  {
    "title": "Task title here",
    "description": "Optional description here",
    "priority": "high|medium|low",
    "assignee": "Name of person if mentioned"
  }
]

Do not include any other text, markdown formatting, or explanations. Just the JSON array.`;

    const response = await miniMax.chat([
      {
        role: 'user',
        content: prompt
      }
    ], undefined, 0.3);

    let extractedTasks: any[] = [];

    try {
      // Try to parse the response as JSON
      const content = response.choices[0]?.message?.content || '';
      // Clean up the response to extract just the JSON array
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedTasks = JSON.parse(jsonMatch[0]);
      }

      // Validate and clean up the tasks
      extractedTasks = extractedTasks
        .filter(task => task.title && typeof task.title === 'string')
        .map(task => ({
          title: task.title.trim().substring(0, 100),
          description: (task.description || '').trim().substring(0, 500),
          priority: ['high', 'medium', 'low'].includes(task.priority?.toLowerCase())
            ? task.priority.toLowerCase()
            : 'medium',
          suggestedAssignee: (task.assignee || '').trim()
        }))
        .slice(0, maxTasks);

    } catch (parseError) {
      logger.error('Failed to parse AI response:', parseError);
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to parse AI response. Please try again.' }
      });
    }

    if (extractedTasks.length === 0) {
      return res.status(500).json({
        success: false,
        error: { message: 'Could not extract any tasks from the text. Please try a different input.' }
      });
    }

    logger.info(`AI generated ${extractedTasks.length} tasks from text`);

    res.json({
      success: true,
      data: {
        tasks: extractedTasks,
        count: extractedTasks.length,
        sourceTextLength: text.length
      }
    });
  } catch (error: any) {
    logger.error('AI task generation failed:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate tasks. Please try again.' }
    });
  }
}));

/**
 * POST /api/tasks/bulk-create
 * Create multiple tasks at once
 */
router.post('/bulk-create', asyncHandler(async (req: Request, res: Response) => {
  const { tasks } = req.body;

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Tasks array is required' }
    });
  }

  if (tasks.length > 100) {
    return res.status(400).json({
      success: false,
      error: { message: 'Maximum 100 tasks can be created at once' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const createdTasks: any[] = [];
  const errors: any[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const title = task.title?.trim();
      if (!title) {
        errors.push({ index: i, error: 'Title is required' });
        continue;
      }

      const priority = ['low', 'medium', 'high'].includes(task.priority?.toLowerCase())
        ? task.priority.toLowerCase()
        : 'medium';
      const status = ['pending', 'in_progress', 'completed'].includes(task.status?.toLowerCase())
        ? task.status.toLowerCase()
        : 'pending';
      const type = ['daily', 'weekly', 'monthly', 'one_time'].includes(task.type?.toLowerCase())
        ? task.type.toLowerCase()
        : 'one_time';

      await db.run(`
        INSERT INTO tasks (
          id, restaurant_id, title, description, type, assigned_to, due_date, status, priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        taskId,
        restaurantId,
        title,
        task.description?.trim() || null,
        type,
        task.assignedTo || null,
        task.dueDate || null,
        status,
        priority
      ]);

      createdTasks.push({
        taskId,
        title,
        priority,
        status
      });
    } catch (err: any) {
      errors.push({ index: i, error: err.message });
    }
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'bulk_create_tasks',
    'tasks',
    'bulk',
    { totalRequested: tasks.length, created: createdTasks.length, errors: errors.length }
  );

  logger.info(`Bulk created ${createdTasks.length} tasks`);

  res.status(201).json({
    success: true,
    data: {
      created: createdTasks,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: tasks.length,
        created: createdTasks.length,
        failed: errors.length
      }
    }
  });
}));

export default router;