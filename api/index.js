const { kv } = require('@vercel/kv');

// Storage key for orders
const ORDERS_KEY = 'food-truck-orders';

// Helper functions
const readOrders = async () => {
    try {
        const orders = await kv.get(ORDERS_KEY);
        return orders || [];
    } catch (error) {
        console.error('Error reading orders from KV:', error);
        return [];
    }
};

const writeOrders = async (orders) => {
    try {
        await kv.set(ORDERS_KEY, orders);
        return true;
    } catch (error) {
        console.error('Error writing orders to KV:', error);
        return false;
    }
};

// Main handler for all API routes
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { method, url } = req;
    const path = url.split('?')[0];

    try {
        // GET /api - Health check
        if (method === 'GET' && (path === '/api' || path === '/api/health')) {
            return res.status(200).json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                storage: 'Vercel KV'
            });
        }

        // GET /api/orders - Get all orders
        if (method === 'GET' && path === '/api/orders') {
            const orders = await readOrders();
            return res.status(200).json(orders);
        }

        // POST /api/orders - Create new order
        if (method === 'POST' && path === '/api/orders') {
            const orders = await readOrders();
            
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
            return res.status(201).json(newOrder);
        }

        // GET /api/orders/:id - Get single order
        if (method === 'GET' && path.match(/^\/api\/orders\/\d+$/)) {
            const id = parseInt(path.split('/').pop());
            const orders = await readOrders();
            const order = orders.find(o => o.id === id);
            
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            return res.status(200).json(order);
        }

        // PATCH /api/orders/:id - Update order
        if (method === 'PATCH' && path.match(/^\/api\/orders\/\d+$/)) {
            const id = parseInt(path.split('/').pop());
            const orders = await readOrders();
            const orderIndex = orders.findIndex(o => o.id === id);
            
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
            return res.status(200).json(orders[orderIndex]);
        }

        // DELETE /api/orders/:id - Delete single order
        if (method === 'DELETE' && path.match(/^\/api\/orders\/\d+$/)) {
            const id = parseInt(path.split('/').pop());
            const orders = await readOrders();
            const filteredOrders = orders.filter(o => o.id !== id);
            
            if (orders.length === filteredOrders.length) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            const saved = await writeOrders(filteredOrders);
            
            if (!saved) {
                return res.status(500).json({ error: 'Failed to delete order' });
            }
            
            console.log(`🗑️  Order #${id} deleted`);
            return res.status(200).json({ message: 'Order deleted successfully' });
        }

        // DELETE /api/orders - Clear all orders
        if (method === 'DELETE' && path === '/api/orders') {
            await writeOrders([]);
            console.log('🗑️  All orders cleared');
            return res.status(200).json({ message: 'All orders cleared successfully' });
        }

        // Route not found
        return res.status(404).json({ error: 'Not found' });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
