package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func health(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func main() {
	r := mux.NewRouter()

	r.HandleFunc("/health", health).Methods("GET")

	log.Fatal(http.ListenAndServe(":8080", r))
}
