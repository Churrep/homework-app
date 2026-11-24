package homework

import (
	"cmp"
	"errors"
	"slices"
	"sync"
	"time"
)

var (
	ErrNotFound = errors.New("homework not found")
)

type Homework struct {
	ID          int       `json:"id"`
	SubjectID   int       `json:"subject_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	CreatedBy   int       `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

type Storage struct {
	mtx    sync.RWMutex
	items  map[int]Homework
	nextID int
}

func NewHomework(subjectID int, title, description string, dueDate time.Time) Homework {
	return Homework{
		SubjectID:   subjectID,
		Title:       title,
		Description: description,
		DueDate:     dueDate,
	}
}

func NewStorage() *Storage {
	return &Storage{
		items:  make(map[int]Homework),
		nextID: 1,
	}
}

func (s *Storage) Create(hw Homework) Homework {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	hw.ID = s.nextID
	hw.CreatedAt = time.Now()
	s.items[hw.ID] = hw
	s.nextID++
	return hw
}

func (s *Storage) GetById(id int) (Homework, error) {
	s.mtx.RLock()
	defer s.mtx.RUnlock()
	hw, ok := s.items[id]

	if !ok {
		return Homework{}, ErrNotFound
	}

	return hw, nil
}

func (s *Storage) List() []Homework {
	s.mtx.RLock()
	defer s.mtx.RUnlock()

	a := make([]Homework, 0, len(s.items))
	for _, hw := range s.items {
		a = append(a, hw)
	}
	slices.SortFunc(a, func(c, b Homework) int {
		return cmp.Compare(c.ID, b.ID)
	})
	return a
}

func (s *Storage) Update(id int, hw Homework) (Homework, error) {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	old, ok := s.items[id]

	if !ok {
		return Homework{}, ErrNotFound
	}

	old.SubjectID = hw.SubjectID
	old.Title = hw.Title
	old.Description = hw.Description
	old.DueDate = hw.DueDate
	s.items[id] = old
	return old, nil
}

func (s *Storage) Delete(id int) error {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	_, ok := s.items[id]

	if !ok {
		return ErrNotFound
	}
	delete(s.items, id)
	return nil
}
