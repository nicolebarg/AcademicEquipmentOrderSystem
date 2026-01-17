// Load environment variables FIRST (must be first line)
require('dotenv').config();

// ------------------------------------------------------------

const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');

// Import Supabase client for health check
const { supabase } = require('./utils/supabaseClient');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');
const logsRoutes = require('./routes/logs.routes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/logs', logsRoutes);

// Health check endpoint — now tests real DB connection
app.get('/api/health', async (req, res) => {
  try {
    // Simple query to verify Supabase connectivity
    const { data, error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
      return res.status(500).json({ 
        status: 'error', 
        database: 'disconnected',
        message: error.message,
        timestamp: new Date().toISOString() 
      });
    }
    
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      message: err.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST   /api/auth/login`);
  console.log(`  GET    /api/health`);
  console.log(`  GET    /api/users`);
  console.log(`  GET    /api/products`);
  console.log(`  GET    /api/orders`);
  console.log(`  POST   /api/orders`);
  console.log(`  PUT    /api/orders/:id/approve`);
  console.log(`  PUT    /api/orders/:id/reject`);
  console.log(`  GET    /api/logs`);
  console.log(`  POST   /api/logs`);
});
