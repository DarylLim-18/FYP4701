CREATE TABLE files (
    file_id SERIAL PRIMARY KEY,
    file_name VARCHAR(255),
    file_data BYTEA
);

CREATE TABLE cache (
    cache_id int,
    cache_name VARCHAR(255),
    cache_data JSONB,
    updated_time timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cache_id)
);