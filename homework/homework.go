package homework

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound       = errors.New("homework not found")
	ErrInvalidInput   = errors.New("invalid input")
	ErrInvalidSubject = errors.New("invalid subject")
)

type Homework struct {
	ID          int       `json:"id"`
	SubjectID   int       `json:"subject_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	CreatedBy   int       `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Repository interface {
	Create(ctx context.Context, hw Homework) (Homework, error)
	GetById(ctx context.Context, id int) (Homework, error)
	List(ctx context.Context) ([]Homework, error)
	Update(ctx context.Context, id int, hw Homework) (Homework, error)
	Delete(ctx context.Context, id int) error
}

func NewHomework(subjectID int, title, description string, dueDate time.Time) Homework {
	return Homework{
		SubjectID:   subjectID,
		Title:       title,
		Description: description,
		DueDate:     dueDate,
	}
}
