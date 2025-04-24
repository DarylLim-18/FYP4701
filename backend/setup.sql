CREATE TABLE files (
    file_id SERIAL PRIMARY KEY,
    file_name VARCHAR(255),
    file_data BYTEA
);
