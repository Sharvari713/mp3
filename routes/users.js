const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Task = require('../models/task');

// Helper function to build query
const buildQuery = (queryParams) => {
    const { where, sort, select, skip, limit, count } = queryParams;
    
    let query = User.find();
    
    if (where) {
        try {
            const whereObj = JSON.parse(where);
            query = query.where(whereObj);
        } catch (e) {
            throw new Error('Invalid where parameter');
        }
    }
    
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
    
    if (limit) {
        query = query.limit(parseInt(limit));
    }
    
    return { query, count: count === 'true' };
};

// GET /api/users
router.get('/', async (req, res) => {
    try {
        const { query, count } = buildQuery(req.query);
        
        if (count) {
            const total = await User.countDocuments(query.getQuery());
            return res.status(200).json({
                message: 'OK',
                data: total
            });
        }
        
        const users = await query.exec();
        res.status(200).json({
            message: 'OK',
            data: users
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error retrieving users',
            data: {}
        });
    }
});

// POST /api/users
router.post('/', async (req, res) => {
    try {
        const { name, email, pendingTasks } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({
                message: 'Name and email are required',
                data: {}
            });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: 'User with this email already exists',
                data: {}
            });
        }
        
        const user = new User({
            name,
            email,
            pendingTasks: pendingTasks || []
        });
        
        const savedUser = await user.save();
        
        res.status(201).json({
            message: 'User created successfully',
            data: savedUser
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error creating user',
            data: {}
        });
    }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
    try {
        const { select } = req.query;
        let query = User.findById(req.params.id);
        
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
        
        const user = await query.exec();
        
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                data: {}
            });
        }
        
        res.status(200).json({
            message: 'OK',
            data: user
        });
    } catch (error) {
        res.status(404).json({
            message: 'User not found',
            data: {}
        });
    }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, email, pendingTasks } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({
                message: 'Name and email are required',
                data: {}
            });
        }
        
        const existingUser = await User.findOne({ 
            email, 
            _id: { $ne: req.params.id } 
        });
        
        if (existingUser) {
            return res.status(400).json({
                message: 'User with this email already exists',
                data: {}
            });
        }
        
        const oldUser = await User.findById(req.params.id);
        if (!oldUser) {
            return res.status(404).json({
                message: 'User not found',
                data: {}
            });
        }
        
        // Handle two-way reference for pendingTasks
        const oldPendingTasks = oldUser.pendingTasks || [];
        const newPendingTasks = pendingTasks || [];
        
        // Remove tasks that are no longer pending
        const removedTasks = oldPendingTasks.filter(
            taskId => !newPendingTasks.includes(taskId)
        );
        
        // Add tasks that are now pending
        const addedTasks = newPendingTasks.filter(
            taskId => !oldPendingTasks.includes(taskId)
        );
        
        // Unassign removed tasks
        for (const taskId of removedTasks) {
            await Task.findByIdAndUpdate(taskId, {
                assignedUser: '',
                assignedUserName: 'unassigned'
            });
        }
        
        // Assign added tasks
        for (const taskId of addedTasks) {
            await Task.findByIdAndUpdate(taskId, {
                assignedUser: req.params.id,
                assignedUserName: name
            });
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, pendingTasks: newPendingTasks },
            { new: true, runValidators: true }
        );
        
        res.status(200).json({
            message: 'User updated successfully',
            data: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error updating user',
            data: {}
        });
    }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                data: {}
            });
        }
        
        // Unassign all tasks assigned to this user
        await Task.updateMany(
            { assignedUser: req.params.id },
            { 
                assignedUser: '',
                assignedUserName: 'unassigned'
            }
        );
        
        await User.findByIdAndDelete(req.params.id);
        
        res.status(200).json({
            message: 'User deleted successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || 'Error deleting user',
            data: {}
        });
    }
});

module.exports = router;