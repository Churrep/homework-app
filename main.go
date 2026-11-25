package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"homework-app/homework"
	"homework-app/server"

	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://homework:secret@localhost:5433/homework"
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	storage := homework.NewPostgresStorage(pool)
	srv := server.New(storage)

	r := mux.NewRouter()
	r.HandleFunc("/health", srv.Health).Methods("GET")
	r.HandleFunc("/homeworks", srv.ListHomeworks).Methods("GET")
	r.HandleFunc("/homeworks/{id}", srv.GetHomework).Methods("GET")
	r.HandleFunc("/homeworks", srv.CreateHomework).Methods("POST")
	r.HandleFunc("/homeworks/{id}", srv.DeleteHomework).Methods("DELETE")
	r.HandleFunc("/homeworks/{id}", srv.UpdateHomework).Methods("PUT")
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("web")))
	log.Println("listening on :6457")
	log.Fatal(http.ListenAndServe(":6457", r))
}
