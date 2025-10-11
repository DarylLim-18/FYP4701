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

CREATE TABLE asthma_geodata(
    asthmageo_id int,
    asthmageo_name VARCHAR(255),
    asthmageo_data JSONB,
    PRIMARY KEY(asthmageo_id)
);

ALTER TABLE asthma_geodata
    ADD CONSTRAINT unique_asthmageo_name UNIQUE (asthmageo_name);


CREATE TABLE user_geodata(
    usergeo_id int,
    usergeo_name VARCHAR(255),
    usergeo_data JSONB,
    PRIMARY KEY(usergeo_id)
);

