package server

import (
	"encoding/json"
	"errors"
	"homework-app/homework"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
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
	storage homework.Repository
}

type homeworkRequest struct {
	SubjectID   int    `json:"subject_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	DueDate     string `json:"due_date"`
}

func New(storage homework.Repository) *Server {
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
	return strconv.Atoi(mux.Vars(r)["id"])
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

func writeStorageError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, homework.ErrNotFound):
		writeError(w, http.StatusNotFound, "домашнее задание не найдено")
	case errors.Is(err, homework.ErrInvalidSubject):
		writeValidationError(w, map[string]string{"subject_id": "предмет не существует"})
	default:
		log.Printf("storage error: %v", err)
		writeError(w, http.StatusInternalServerError, "внутренняя ошибка")
	}
}

func (s *Server) ListHomeworks(w http.ResponseWriter, r *http.Request) {
	list, err := s.storage.List(r.Context())
	if err != nil {
		writeStorageError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) GetHomework(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "id должен быть числом")
		return
	}
	hw, err := s.storage.GetById(r.Context(), id)
	if err != nil {
		writeStorageError(w, err)
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
	created, err := s.storage.Create(r.Context(), hw)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
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
	updated, err := s.storage.Update(r.Context(), id, hw)
	if err != nil {
		writeStorageError(w, err)
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
	if err := s.storage.Delete(r.Context(), id); err != nil {
		writeStorageError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
