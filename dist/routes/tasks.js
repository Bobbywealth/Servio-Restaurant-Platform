"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const bus_1 = require("../events/bus");
const router = (0, express_1.Router)();
const num = (v) => (typeof v === 'number' ? v : Number(v ?? 0));
/**
 * GET /api/tasks/today
 * Get today's tasks
 */
router.get('/today', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { status } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const dialect = DatabaseService_1.DatabaseService.getInstance().getDialect();
    const restaurantId = req.user?.restaurantId;
    let query = dialect === 'postgres'
        ? `
          SELECT * FROM tasks
          WHERE (type = 'daily'
          OR (due_date IS NOT NULL AND due_date::date = CURRENT_DATE)
          OR (type = 'one_time' AND status != 'completed'))
          AND restaurant_id = ?
        `
        : `
          SELECT * FROM tasks
          WHERE (type = 'daily'
          OR (due_date IS NOT NULL AND DATE(due_date) = DATE('now'))
          OR (type = 'one_time' AND status != 'completed'))
          AND restaurant_id = ?
        `;
    const params = [restaurantId];
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
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { status, type, assignedTo } = req.query;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const restaurantId = req.user?.restaurantId;
    let query = 'SELECT * FROM tasks';
    const params = [restaurantId];
    const conditions = ['restaurant_id = ?'];
    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (type) {
        conditions.push('type = ?');
        params.push(type);
    }
    if (assignedTo) {
        conditions.push('assigned_to = ?');
        params.push(assignedTo);
    }
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';
    const tasks = await db.all(query, params);
    res.json({
        success: true,
        data: tasks
    });
}));
/**
 * POST /api/tasks/:id/complete
 * Mark a task as completed
 */
router.post('/:id/complete', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { userId } = req.body;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND restaurant_id = ?', [id, req.user?.restaurantId]);
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
    await db.run('UPDATE tasks SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['completed', new Date().toISOString(), id]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(req.user?.restaurantId, req.user?.id || 'system', 'complete_task', 'task', id, { taskTitle: task.title, taskType: task.type });
    await bus_1.eventBus.emit('task.completed', {
        restaurantId: req.user?.restaurantId,
        type: 'task.completed',
        actor: { actorType: 'user', actorId: req.user?.id },
        payload: { taskId: id, title: task.title },
        occurredAt: new Date().toISOString()
    });
    logger_1.logger.info(`Task completed: ${task.title}`);
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
router.post('/:id/start', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { userId } = req.body;
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND restaurant_id = ?', [id, req.user?.restaurantId]);
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
    await db.run('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['in_progress', id]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(req.user?.restaurantId, req.user?.id || 'system', 'start_task', 'task', id, { taskTitle: task.title });
    logger_1.logger.info(`Task started: ${task.title}`);
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
 * GET /api/tasks/stats
 * Get task statistics
 */
router.get('/stats', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const dialect = DatabaseService_1.DatabaseService.getInstance().getDialect();
    const restaurantId = req.user?.restaurantId;
    const completedTodayCondition = dialect === 'postgres'
        ? "status = 'completed' AND completed_at::date = CURRENT_DATE"
        : 'status = \'completed\' AND DATE(completed_at) = DATE(\'now\')';
    const [totalTasks, pendingTasks, completedToday, tasksByType, tasksByStatus] = await Promise.all([
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
        byType: tasksByType.reduce((acc, row) => {
            acc[row.type] = num(row.count);
            return acc;
        }, {}),
        byStatus: tasksByStatus.reduce((acc, row) => {
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
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { title, description, type = 'one_time', assignedTo, dueDate, userId } = req.body;
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
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.run(`
    INSERT INTO tasks (
      id, restaurant_id, title, description, type, assigned_to, due_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        taskId,
        req.user?.restaurantId,
        title,
        description || null,
        type,
        assignedTo || null,
        dueDate || null,
        'pending'
    ]);
    await DatabaseService_1.DatabaseService.getInstance().logAudit(req.user?.restaurantId, req.user?.id || 'system', 'create_task', 'task', taskId, { title, type, assignedTo });
    await bus_1.eventBus.emit('task.created', {
        restaurantId: req.user?.restaurantId,
        type: 'task.created',
        actor: { actorType: 'user', actorId: req.user?.id },
        payload: { taskId, title, assignedTo },
        occurredAt: new Date().toISOString()
    });
    logger_1.logger.info(`New task created: ${title}`);
    res.status(201).json({
        success: true,
        data: {
            taskId,
            title,
            type,
            status: 'pending',
            createdAt: new Date().toISOString()
        }
    });
}));
exports.default = router;
//# sourceMappingURL=tasks.js.map