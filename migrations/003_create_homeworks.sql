CREATE TABLE homeworks (
    id          serial      PRIMARY KEY,
    subject_id  integer     NOT NULL REFERENCES subjects(id),
    created_by  integer     NOT NULL,
    title       text        NOT NULL CHECK (btrim(title) <> ''),
    description text        NOT NULL DEFAULT '',
    due_date    date        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX homeworks_due_date_idx   ON homeworks (due_date);
CREATE INDEX homeworks_subject_id_idx ON homeworks (subject_id);
CREATE INDEX homeworks_created_by_idx ON homeworks (created_by);