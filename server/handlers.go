package server

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
}
