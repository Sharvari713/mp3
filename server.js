const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    // Decode query parameters
    Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
            try {
                req.query[key] = decodeURIComponent(req.query[key]);
            } catch (e) {
                // If decoding fails, keep original
            }
        }
    });
    next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/tasks', require('./routes/tasks'));

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Llama.io Task API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal server error',
        data: {}
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);  // ← Fixed this line!
});

module.exports = app;