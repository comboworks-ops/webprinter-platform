-- Additional tables for extended order features

-- Order notes/comments (for admin internal notes)
CREATE TABLE IF NOT EXISTS order_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT TRUE, -- internal = admin only, false = visible to customer
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order messages (customer <-> admin communication)
CREATE TABLE IF NOT EXISTS order_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'admin')),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS order_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 25, -- Danish VAT
    total DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'DKK',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
    paid_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery tracking events
CREATE TABLE IF NOT EXISTS delivery_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- picked_up, in_transit, out_for_delivery, delivered, etc.
    location TEXT,
    description TEXT,
    carrier TEXT, -- PostNord, GLS, etc.
    tracking_data JSONB,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON order_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_is_read ON order_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_order_invoices_order_id ON order_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_id ON delivery_tracking(order_id);

-- Enable RLS
ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Order notes policies (admin only for internal)
CREATE POLICY "Admins can manage order notes" ON order_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can view non-internal notes on own orders" ON order_notes
    FOR SELECT USING (
        NOT is_internal AND EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_notes.order_id 
            AND orders.user_id = auth.uid()
        )
    );

-- Order messages policies
CREATE POLICY "Users can view messages on own orders" ON order_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_messages.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages on own orders" ON order_messages
    FOR INSERT WITH CHECK (
        sender_type = 'customer' AND EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_messages.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all messages" ON order_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Invoice policies
CREATE POLICY "Users can view own invoices" ON order_invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_invoices.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage invoices" ON order_invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Delivery tracking policies
CREATE POLICY "Users can view own delivery tracking" ON delivery_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = delivery_tracking.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage delivery tracking" ON delivery_tracking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Invoice number generator
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    year_prefix TEXT;
BEGIN
    year_prefix := TO_CHAR(NOW(), 'YYYY');
    SELECT 'INV-' || year_prefix || '-' || LPAD((COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 11) AS INTEGER)), 0) + 1)::TEXT, 5, '0')
    INTO new_number
    FROM order_invoices
    WHERE invoice_number LIKE 'INV-' || year_prefix || '-%';
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;
