const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const User = require('../models/user');

// Helper function to build query
const buildQuery = (queryParams) => {
    const { where, sort, select, skip, limit, count } = queryParams;
    
    let filter = {};
    
    if (where) {
        try {
            filter = typeof where === "string" ? JSON.parse(where) : where;
        } catch (e) {
            throw new Error('Invalid where parameter');
        }
    }
    
    let query = Task.find(filter);
    
    if (sort) {
        try {
            const sortObj = JSON.parse(sort);
            query = query.sort(sortObj);
        } catch (e) {
            throw new Error('Invalid sort parameter');
        }
    }
    
    if (select) {
        try {
            const selectObj = JSON.parse(select);
            query = query.select(selectObj);
        } catch (e) {
            throw new Error('Invalid select parameter');
        }
    }
    
    if (skip) {
        query = query.skip(parseInt(skip));
    }
    
    const limitValue = limit ? parseInt(limit) : 100;
    query = query.limit(limitValue);
    
    return { query, count: count === 'true' };
};

// GET /api/tasks
router.get('/', async (req, res) => {
    try {
        const { query, count } = buildQuery(req.query);
        
        if (count) {
            const filter = query.getFilter ? query.getFilter() : query._conditions;
            const total = await Task.countDocuments(filter);
            return res.status(200).json({
                message: 'OK',
                data: total
            });
        }
        
        const tasks = await query.exec();
        res.status(200).json({
            message: 'OK',
            data: tasks
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error retrieving tasks',
            data: {}
        });
    }
});

// POST /api/tasks
router.post('/', async (req, res) => {
    try {
        const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;
        
        if (!name || !deadline) {
            return res.status(400).json({
                message: 'Name and deadline are required',
                data: {}
            });
        }
        
        const task = new Task({
            name,
            description: description || '',
            deadline,
            completed: completed || false,
            assignedUser: assignedUser || '',
            assignedUserName: assignedUserName || 'unassigned'
        });
        
        const savedTask = await task.save();
        
        // If task is assigned, update user's pendingTasks
        if (assignedUser && assignedUser !== '') {
            await User.findByIdAndUpdate(
                assignedUser,
                { $addToSet: { pendingTasks: savedTask._id.toString() } }
            );
        }
        
        res.status(201).json({
            message: 'Task created successfully',
            data: savedTask
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error creating task',
            data: {}
        });
    }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
    try {
        const { select } = req.query;
        let query = Task.findById(req.params.id);
        
        if (select) {
            try {
                const selectObj = JSON.parse(select);
                query = query.select(selectObj);
            } catch (e) {
                return res.status(400).json({
                    message: 'Invalid select parameter',
                    data: {}
                });
            }
        }
        
        const task = await query.exec();
        
        if (!task) {
            return res.status(404).json({
                message: 'Task not found',
                data: {}
            });
        }
        
        res.status(200).json({
            message: 'OK',
            data: task
        });
    } catch (error) {
        res.status(404).json({
            message: 'Task not found',
            data: {}
        });
    }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;
        
        if (!name || !deadline) {
            return res.status(400).json({
                message: 'Name and deadline are required',
                data: {}
            });
        }
        
        const oldTask = await Task.findById(req.params.id);
        if (!oldTask) {
            return res.status(404).json({
                message: 'Task not found',
                data: {}
            });
        }
        
        const oldAssignedUser = oldTask.assignedUser;
        const newAssignedUser = assignedUser || '';
        
        // Handle two-way reference for assignedUser
        if (oldAssignedUser !== newAssignedUser) {
            // Remove task from old user's pendingTasks
            if (oldAssignedUser && oldAssignedUser !== '') {
                await User.findByIdAndUpdate(
                    oldAssignedUser,
                    { $pull: { pendingTasks: req.params.id } }
                );
            }
            
            // Add task to new user's pendingTasks
            if (newAssignedUser && newAssignedUser !== '') {
                await User.findByIdAndUpdate(
                    newAssignedUser,
                    { $addToSet: { pendingTasks: req.params.id } }
                );
            }
        }
        
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description: description || '',
                deadline,
                completed: completed !== undefined ? completed : false,
                assignedUser: newAssignedUser,
                assignedUserName: assignedUserName || 'unassigned'
            },
            { new: true, runValidators: true }
        );
        
        res.status(200).json({
            message: 'Task updated successfully',
            data: updatedTask
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error updating task',
            data: {}
        });
    }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                message: 'Task not found',
                data: {}
            });
        }
        
        // Remove task from assigned user's pendingTasks
        if (task.assignedUser && task.assignedUser !== '') {
            await User.findByIdAndUpdate(
                task.assignedUser,
                { $pull: { pendingTasks: req.params.id } }
            );
        }
        
        await Task.findByIdAndDelete(req.params.id);
        
        res.status(200).json({
            message: 'Task deleted successfully',
            data: task
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error deleting task',
            data: {}
        });
    }
});

module.exports = router;