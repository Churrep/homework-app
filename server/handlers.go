package server

import (
	"encoding/json"
	"errors"
	"homework-app/homework"
	"net/http"
	"strconv"
	"strings"
	"time"
)

/*
GET    /health                                   200 {"status":"ok"}

POST   /auth/register     email, password, name, group_code → 201 / 400 / 409
POST   /auth/login        email, password → 200 {"token": "..."} / 401
GET    /me                                       текущий пользователь

GET    /subjects
POST   /subjects                                 admin → 201 / 403 / 409

GET    /homeworks?from=YYYY-MM-DD&to=YYYY-MM-DD&subject_id=
GET    /homeworks/{id}                           200 / 404
POST   /homeworks                                201 / 400
PUT    /homeworks/{id}                           автор или admin → 200 / 403 / 404
DELETE /homeworks/{id}                           автор или admin → 204 / 403 / 404

GET    /notes?from=...&to=...&subject_id=...
GET    /notes/{id}
POST   /notes
PUT    /notes/{id}
DELETE /notes/{id}
*/

type Server struct {
	storage *homework.Storage
}

type homeworkRequest struct {
	SubjectID   int    `json:"subject_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	DueDate     string `json:"due_date"`
}

func New(storage *homework.Storage) *Server {
	return &Server{
		storage: storage,
	}
}

func (req homeworkRequest) toHomework() (homework.Homework, map[string]string) {
	errs := map[string]string{}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		errs["title"] = "не может быть пустым"
	}
	if req.SubjectID <= 0 {
		errs["subject_id"] = "должен быть положительным"
	}
	dueDate, err := time.Parse("2006-01-02", req.DueDate)
	if err != nil {
		errs["due_date"] = "формат YYYY-MM-DD"
	}

	if len(errs) > 0 {
		return homework.Homework{}, errs
	}
	return homework.NewHomework(req.SubjectID, title, req.Description, dueDate), nil
}

func parseID(r *http.Request) (int, error) {
	return strconv.Atoi(r.PathValue("id"))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeValidationError(w http.ResponseWriter, fields map[string]string) {
	writeJSON(w, http.StatusBadRequest, map[string]any{
		"error":  "validation",
		"fields": fields,
	})
}

func (s *Server) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ListHomeworks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.storage.List())
}

func (s *Server) GetHomework(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "id должен быть числом")
		return
	}
	hw, err := s.storage.GetById(id)
	if errors.Is(err, homework.ErrNotFound) {
		writeError(w, http.StatusNotFound, "домашнее задание не найдено")
		return
	}
	writeJSON(w, http.StatusOK, hw)
}

func (s *Server) CreateHomework(w http.ResponseWriter, r *http.Request) {
	var req homeworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "неверный формат JSON")
		return
	}
	hw, errs := req.toHomework()
	if len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}
	hw = s.storage.Create(hw)
	writeJSON(w, http.StatusCreated, hw)
}

func (s *Server) UpdateHomework(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "id должен быть числом")
		return
	}
	var req homeworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "неверный формат JSON")
		return
	}
	hw, errs := req.toHomework()
	if len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}
	updated, err := s.storage.Update(id, hw)
	if errors.Is(err, homework.ErrNotFound) {
		writeError(w, http.StatusNotFound, "домашнее задание не найдено")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) DeleteHomework(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "id должен быть числом")
		return
	}
	err = s.storage.Delete(id)
	if errors.Is(err, homework.ErrNotFound) {
		writeError(w, http.StatusNotFound, "домашнее задание не найдено")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
