CREATE TABLE subjects (
    id   serial PRIMARY KEY,
    name text   NOT NULL UNIQUE CHECK (btrim(name) <> '')
);
