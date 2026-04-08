CREATE TABLE IF NOT EXISTS markets (
    id SERIAL PRIMARY KEY, 
    name TEXT NOT NULL, 
    district TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
    id SERIAL PRIMARY KEY,
    market_id INT REFERENCES markets(id) ON DELETE CASCADE, 
    commodity TEXT NOT NULL, 
    date DATE NOT NULL, 
    price NUMERIC NOT NULL, 
    arrival_qty INT
);
