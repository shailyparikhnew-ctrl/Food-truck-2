// Import Supabase client
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
                storage: supabase ? 'Supabase PostgreSQL (Persistent)' : 'Not Configured',
                dbConfigured: !!supabase
            });
        }

        // GET /api/orders - Get all orders
        if (method === 'GET' && path === '/api/orders') {
            if (!supabase) {
                return res.status(200).json([]);
            }

            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error reading orders:', error);
                return res.status(500).json({ error: 'Failed to fetch orders' });
            }

            // Convert DB format to frontend format
            const orders = (data || []).map(order => ({
                id: order.order_number,
                items: order.items,
                total: order.total,
                type: order.order_type,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                timestamp: order.order_timestamp,
                date: order.order_date,
                status: order.status,
                createdAt: order.created_at,
                updatedAt: order.updated_at
            }));

            return res.status(200).json(orders);
        }

        // POST /api/orders - Create new order
        if (method === 'POST' && path === '/api/orders') {
            const body = await parseBody(req);
            
            if (!supabase) {
                return res.status(500).json({ error: 'Database not configured' });
            }
            
            const orderData = {
                order_number: Date.now(),
                items: body.items || [],
                total: body.total || 0,
                order_type: body.type || 'eat',
                customer_name: body.customerName || '',
                customer_phone: body.customerPhone || '',
                order_timestamp: body.timestamp || new Date().toLocaleTimeString(),
                order_date: body.date || new Date().toLocaleDateString(),
                status: 'pending'
            };
            
            const { data, error } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();
            
            if (error) {
                console.error('Error creating order:', error);
                return res.status(500).json({ error: 'Failed to save order' });
            }
            
            console.log(`✅ New order: #${data.order_number} - ${data.customer_name}`);
            
            // Return in format expected by frontend
            return res.status(201).json({
                id: data.order_number,
                items: data.items,
                total: data.total,
                type: data.order_type,
                customerName: data.customer_name,
                customerPhone: data.customer_phone,
                timestamp: data.order_timestamp,
                date: data.order_date,
                status: data.status,
                createdAt: data.created_at
            });
        }

        // GET /api/orders/:id - Get single order
        const getMatch = path.match(/^\/api\/orders\/(\d+)$/);
        if (method === 'GET' && getMatch) {
            const orderNumber = parseInt(getMatch[1]);
            
            if (!supabase) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('order_number', orderNumber)
                .single();
            
            if (error || !data) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            return res.status(200).json({
                id: data.order_number,
                items: data.items,
                total: data.total,
                type: data.order_type,
                customerName: data.customer_name,
                customerPhone: data.customer_phone,
                timestamp: data.order_timestamp,
                date: data.order_date,
                status: data.status,
                createdAt: data.created_at
            });
        }

        // PATCH /api/orders/:id - Update order
        const patchMatch = path.match(/^\/api\/orders\/(\d+)$/);
        if (method === 'PATCH' && patchMatch) {
            const orderNumber = parseInt(patchMatch[1]);
            const body = await parseBody(req);
            
            if (!supabase) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            const updates = {
                status: body.status,
                updated_at: new Date().toISOString()
            };
            
            const { data, error } = await supabase
                .from('orders')
                .update(updates)
                .eq('order_number', orderNumber)
                .select()
                .single();
            
            if (error || !data) {
                console.error('Error updating order:', error);
                return res.status(404).json({ error: 'Order not found' });
            }
            
            console.log(`🔄 Order #${orderNumber} updated to: ${data.status}`);
            
            return res.status(200).json({
                id: data.order_number,
                items: data.items,
                total: data.total,
                type: data.order_type,
                customerName: data.customer_name,
                customerPhone: data.customer_phone,
                timestamp: data.order_timestamp,
                date: data.order_date,
                status: data.status,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            });
        }

        // DELETE /api/orders/:id - Delete single order
        const deleteMatch = path.match(/^\/api\/orders\/(\d+)$/);
        if (method === 'DELETE' && deleteMatch) {
            const orderNumber = parseInt(deleteMatch[1]);
            
            if (!supabase) {
                return res.status(404).json({ error: 'Order not found' });
            }
            
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('order_number', orderNumber);
            
            if (error) {
                console.error('Error deleting order:', error);
                return res.status(404).json({ error: 'Order not found' });
            }
            
            console.log(`🗑️  Order #${orderNumber} deleted`);
            return res.status(200).json({ message: 'Order deleted successfully' });
        }

        // DELETE /api/orders - Clear all orders
        if (method === 'DELETE' && path === '/api/orders') {
            if (!supabase) {
                return res.status(500).json({ error: 'Database not configured' });
            }
            
            const { error } = await supabase
                .from('orders')
                .delete()
                .neq('id', 0); // Delete all rows
            
            if (error) {
                console.error('Error clearing orders:', error);
                return res.status(500).json({ error: 'Failed to clear orders' });
            }
            
            console.log('🗑️  All orders cleared');
            return res.status(200).json({ message: 'All orders cleared' });
        }

        // Route not found
        return res.status(404).json({ error: 'Route not found', path, method });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message
        });
    }
}
