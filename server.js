const express = require(‘express’);
const cors = require(‘cors’);
const { kv } = require(’@vercel/kv’);

const app = express();
const PORT = process.env.PORT || 3000;

// Storage key for orders
const ORDERS_KEY = ‘food-truck-orders’;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Helper functions for KV storage
const readOrders = async () => {
try {
const orders = await kv.get(ORDERS_KEY);
return orders || [];
} catch (error) {
console.error(‘Error reading orders from KV:’, error);
return [];
}
};

const writeOrders = async (orders) => {
try {
await kv.set(ORDERS_KEY, orders);
return true;
} catch (error) {
console.error(‘Error writing orders to KV:’, error);
return false;
}
};

// API Routes

// Get all orders
app.get(’/api/orders’, async (req, res) => {
try {
const orders = await readOrders();
res.json(orders);
} catch (error) {
console.error(‘Error fetching orders:’, error);
res.status(500).json({ error: ‘Failed to fetch orders’ });
}
});

// Get single order
app.get(’/api/orders/:id’, async (req, res) => {
try {
const orders = await readOrders();
const order = orders.find(o => o.id === parseInt(req.params.id));

```
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
} catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
}
```

});

// Create new order
app.post(’/api/orders’, async (req, res) => {
try {
const orders = await readOrders();

```
    const newOrder = {
        id: Date.now(),
        ...req.body,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    orders.push(newOrder);
    const saved = await writeOrders(orders);
    
    if (!saved) {
        return res.status(500).json({ error: 'Failed to save order' });
    }
    
    console.log(`✅ New order placed: #${newOrder.id} - ${newOrder.customerName}`);
    
    res.status(201).json(newOrder);
} catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
}
```

});

// Update order status
app.patch(’/api/orders/:id’, async (req, res) => {
try {
const orders = await readOrders();
const orderIndex = orders.findIndex(o => o.id === parseInt(req.params.id));

```
    if (orderIndex === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    orders[orderIndex] = {
        ...orders[orderIndex],
        ...req.body,
        updatedAt: new Date().toISOString()
    };
    
    const saved = await writeOrders(orders);
    
    if (!saved) {
        return res.status(500).json({ error: 'Failed to update order' });
    }
    
    console.log(`🔄 Order #${orders[orderIndex].id} status updated to: ${orders[orderIndex].status}`);
    
    res.json(orders[orderIndex]);
} catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
}
```

});

// Delete order
app.delete(’/api/orders/:id’, async (req, res) => {
try {
const orders = await readOrders();
const filteredOrders = orders.filter(o => o.id !== parseInt(req.params.id));

```
    if (orders.length === filteredOrders.length) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    const saved = await writeOrders(filteredOrders);
    
    if (!saved) {
        return res.status(500).json({ error: 'Failed to delete order' });
    }
    
    console.log(`🗑️  Order #${req.params.id} deleted`);
    
    res.json({ message: 'Order deleted successfully' });
} catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
}
```

});

// Clear all orders (admin only - you might want to add authentication)
app.delete(’/api/orders’, async (req, res) => {
try {
await writeOrders([]);
console.log(‘🗑️  All orders cleared’);
res.json({ message: ‘All orders cleared successfully’ });
} catch (error) {
console.error(‘Error clearing orders:’, error);
res.status(500).json({ error: ‘Failed to clear orders’ });
}
});

// Serve customer page at root
app.get(’/’, (req, res) => {
res.sendFile(__dirname + ‘/customer.html’);
});

// Serve kitchen page at /kitchen
app.get(’/kitchen’, (req, res) => {
res.sendFile(__dirname + ‘/kitchen.html’);
});

// Health check endpoint
app.get(’/api/health’, (req, res) => {
res.json({
status: ‘OK’,
timestamp: new Date().toISOString(),
storage: ‘Vercel KV’
});
});

// Start server (only for local development)
if (process.env.NODE_ENV !== ‘production’) {
app.listen(PORT, () => {
console.log(`🍔 Food Truck Server Running! ================================ Customer URL: http://localhost:${PORT}/ Kitchen URL:  http://localhost:${PORT}/kitchen API Endpoint: http://localhost:${PORT}/api/orders Storage:      Vercel KV (Persistent) ================================`);
});
}

// Export for Vercel
module.exports = app;
