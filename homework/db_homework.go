package homework

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const columns = `id, subject_id, title, description, due_date, created_by, created_at, updated_at`

type PostgresStorage struct {
	pool *pgxpool.Pool
}

func NewPostgresStorage(pool *pgxpool.Pool) *PostgresStorage {
	return &PostgresStorage{pool: pool}
}

func scanHomework(row pgx.Row) (Homework, error) {
	var hw Homework
	err := row.Scan(
		&hw.ID,
		&hw.SubjectID,
		&hw.Title,
		&hw.Description,
		&hw.DueDate,
		&hw.CreatedBy,
		&hw.CreatedAt,
		&hw.UpdatedAt,
	)
	return hw, err
}

func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" && pgErr.ConstraintName == "homeworks_subject_id_fkey" {
		return ErrInvalidSubject
	}
	return err
}

func (s *PostgresStorage) Create(ctx context.Context, hw Homework) (Homework, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO homeworks (subject_id, title, description, due_date, created_by)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING `+columns,
		hw.SubjectID, hw.Title, hw.Description, hw.DueDate, hw.CreatedBy,
	)
	created, err := scanHomework(row)
	if err != nil {
		return Homework{}, fmt.Errorf("create homework: %w", mapError(err))
	}
	return created, nil
}

func (s *PostgresStorage) GetById(ctx context.Context, id int) (Homework, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+columns+` FROM homeworks WHERE id = $1`,
		id,
	)
	hw, err := scanHomework(row)
	if err != nil {
		return Homework{}, fmt.Errorf("get homework %d: %w", id, mapError(err))
	}
	return hw, nil
}

func (s *PostgresStorage) List(ctx context.Context) ([]Homework, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+columns+` FROM homeworks ORDER BY due_date, id`,
	)
	if err != nil {
		return nil, fmt.Errorf("list homeworks: %w", err)
	}
	defer rows.Close()

	list := []Homework{}
	for rows.Next() {
		hw, err := scanHomework(rows)
		if err != nil {
			return nil, fmt.Errorf("scan homework: %w", err)
		}
		list = append(list, hw)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate homeworks: %w", err)
	}
	return list, nil
}

func (s *PostgresStorage) Update(ctx context.Context, id int, hw Homework) (Homework, error) {
	row := s.pool.QueryRow(ctx,
		`UPDATE homeworks
		 SET subject_id = $2, title = $3, description = $4, due_date = $5, updated_at = now()
		 WHERE id = $1
		 RETURNING `+columns,
		id, hw.SubjectID, hw.Title, hw.Description, hw.DueDate,
	)
	updated, err := scanHomework(row)
	if err != nil {
		return Homework{}, fmt.Errorf("update homework %d: %w", id, mapError(err))
	}
	return updated, nil
}

func (s *PostgresStorage) Delete(ctx context.Context, id int) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM homeworks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete homework %d: %w", id, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
