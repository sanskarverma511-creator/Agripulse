-- Insert dummy markets loosely based around Pune
INSERT INTO markets (name, district) VALUES
('Pune APMC', 'Pune'),
('Khadki Cantonment', 'Pune'),
('Pimpri Chinchwad', 'Pune'),
('Moshi', 'Pune')
ON CONFLICT DO NOTHING;

-- Insert some dummy prices for Onion, Potato, Tomato
INSERT INTO prices (market_id, commodity, date, price, arrival_qty) VALUES
(1, 'onion', CURRENT_DATE, 25.50, 1500),
(1, 'potato', CURRENT_DATE, 20.00, 1200),
(1, 'tomato', CURRENT_DATE, 40.00, 800),
(2, 'onion', CURRENT_DATE, 26.00, 400),
(2, 'potato', CURRENT_DATE, 21.00, 500),
(3, 'tomato', CURRENT_DATE, 38.00, 600),
(4, 'onion', CURRENT_DATE, 24.50, 2000),
(4, 'potato', CURRENT_DATE, 19.50, 1800),
(4, 'tomato', CURRENT_DATE, 35.00, 1000);
