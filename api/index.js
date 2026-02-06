// Import Vercel KV
import { createClient } from '@vercel/kv';

// Parse REDIS_URL to extract URL and token
// Format: redis://default:TOKEN@HOST:PORT
function parseRedisUrl(redisUrl) {
    if (!redisUrl) return { url: '', token: '' };
    
    try {
        // Extract token from redis://default:TOKEN@host:port
        const match = redisUrl.match(/redis:\/\/default:([^@]+)@(.+)/);
        if (match) {
            const token = match[1];
            const hostAndPort = match[2];
            const url = `https://${hostAndPort}`;
            return { url, token };
        }
        
        // If no match, try to use it as-is
        return { url: redisUrl, token: '' };
    } catch (e) {
        console.error('Error parsing REDIS_URL:', e);
        return { url: '', token: '' };
    }
}

// Initialize KV client
const { url: kvUrl, token: kvToken } = parseRedisUrl(process.env.REDIS_URL);

const kv = createClient({
    url: kvUrl || process.env.KV_REST_API_URL || '',
    token: kvToken || process.env.KV_REST_API_TOKEN || ''
});

// Storage key for orders
const ORDERS_KEY = 'food-truck-orders';

// Helper to parse request body
async function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
    });
}

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

// Main API handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { method } = req;
    const path = req.url?.split('?')[0] || '';

    try {
        // GET /api - Health check
        if (method === 'GET' && (path === '/api' || path === '/api/health' || path === '/')) {
            return res.status(200).json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                storage: 'Vercel KV',
                redisUrl: !!process.env.REDIS_URL,
                kvUrl: !!kvUrl,
                kvToken: !!kvToken
            });
        }

        // GET /api/orders - Get all orders
        if (method === 'GET' && path === '/api/orders') {
            const orders = await readOrders();
            return res.status(200).json(orders);
        }

        // POST /api/orders - Create new order
        if (method === 'POST' && path === '/api/orders') {
            const body = await parseBody(req);
            const orders = await readOrders();
            
            const newOrder = {
                id: Date.now(),
                items: body.items || [],
                total: body.total || 0,
                type: body.type || 'eat',
                customerName: body.customerName || '',
                customerPhone: body.customerPhone || '',
                timestamp: body.timestamp || new Date().toLocaleTimeString(),
                date: body.date || new Date().toLocaleDateString(),
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            orders.push(newOrder);
            const saved = await writeOrders(orders);
            
            if (!saved) {
                return res.status(500).json({ error: 'Failed to save order' });
            }
            
            console.log(`✅ New order: #${newOrder.id} - ${newOrder.customerName}`);
            return res.status(201).json(newOrder);
        }

        // GET /api/orders/:id - Get single order
        const getMatch = path.match(/^\/api\/orders\/(\d+)$/);
        if (method === 'GET' && getMatch) {
            const id = parseInt(getMatch[1]);
            const orders = await readOrders();
            const order = orders.find(o => o.id === id);
            
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            return res.status(200).json(order);
        }

        // PATCH /api/orders/:id - Update order
        const patchMatch = path.match(/^\/api\/orders\/(\d+)$/);
        if (method === 'PATCH' && patchMatch) {
            const id = parseInt(patchMatch[1]);
            const body = await parseBody(req);
            const orders = await readOrders();
            const orderIndex = orders.findIndex(o => o.id === id);
            
            if (orderIndex === -1) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            orders[orderIndex] = {
                ...orders[orderIndex],
                ...body,
                updatedAt: new Date().toISOString()
            };
            
            const saved = await writeOrders(orders);
            
            if (!saved) {
                return res.status(500).json({ error: 'Failed to update order' });
            }
            
            console.log(`🔄 Order #${id} updated to: ${orders[orderIndex].status}`);
            return res.status(200).json(orders[orderIndex]);
        }

        // DELETE /api/orders/:id - Delete single order
        const deleteMatch = path.match(/^\/api\/orders\/(\d+)$/);
        if (method === 'DELETE' && deleteMatch) {
            const id = parseInt(deleteMatch[1]);
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
            return res.status(200).json({ message: 'All orders cleared' });
        }

        // Route not found
        return res.status(404).json({ error: 'Route not found', path, method });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
