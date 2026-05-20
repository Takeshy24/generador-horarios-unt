# Generador de Horarios UNT

Sistema de generación automática de horarios académicos para la Escuela de Ingeniería de Sistemas — Universidad Nacional de Trujillo. Implementa el Reglamento N° 005-2024-INSINV/UNT.

## Stack

| Capa       | Tecnología                                 |
|------------|---------------------------------------------|
| Frontend   | Next.js 15 · App Router · TypeScript · Tailwind · shadcn/ui · NextAuth v5 |
| Backend    | FastAPI · Python · SQLAlchemy · Alembic     |
| Base datos | PostgreSQL 17                               |
| Motor      | Greedy + Backtracking · 11 restricciones    |
| PDFs       | ReportLab                                   |

## Estructura

```
generador-horarios-unt/
├── backend/    FastAPI + SQLAlchemy + Alembic + PostgreSQL 17
└── frontend/   Next.js 15 + Tailwind + shadcn/ui + NextAuth v5
```

---

## 1. Base de datos (PostgreSQL 17)

```powershell
psql -U postgres -c "CREATE DATABASE horario_unt;"
```

---

## 2. Backend (FastAPI)

```powershell
cd backend

# Crear entorno virtual e instalar
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Configurar entorno
copy .env.example .env
# Editar .env: ajustar DATABASE_URL con tu password de Postgres

# Ejecutar migraciones y seed
alembic upgrade head
python -m app.seed.seed_data

# Arrancar
uvicorn app.main:app --reload
```

Servidor en **http://localhost:8000** · Swagger: http://localhost:8000/docs

---

## 3. Frontend (Next.js 15)

```powershell
cd frontend
npm install
npm run dev
```

Frontend en **http://localhost:3000**

---

## Credenciales de demo

| Rol               | Email                        | Password |
|-------------------|------------------------------|----------|
| Administrador     | admin@unt.edu.pe             | admin123 |
| Director Escuela  | director.escuela@unt.edu.pe  | dir123   |
| Director Depto    | director.depto@unt.edu.pe    | depto123 |
| Docente           | docente@unt.edu.pe           | doc123   |

---

## Guía de demostración (6 demos)

### Demo 1 — Generación exitosa
1. Login como `director.escuela@unt.edu.pe`
2. Ir a **Generar Horario** → pulsar "Generar Horario"
3. El motor coloca 115/127 componentes en ~0.3s
4. Mostrar la vista "Por Ciclo" → seleccionar Ciclo VII

### Demo 2 — Hora de almuerzo respetada (R11)
1. En la vista Ciclo VII, mostrar que martes y jueves tienen el slot 12:00 libre
2. *"El horario real de mi ciclo viola esto; el sistema lo previene automáticamente"*

### Demo 3 — Edición con validación en vivo
1. Hacer clic en un bloque de la grilla → se abre el Editor
2. Intentar mover a un slot que genera conflicto → el panel muestra en rojo la restricción violada
3. Mostrar las restricciones R1-R11 listadas en el panel

### Demo 4 — Prelación nombrado vs contratado (R6/ORDEN)
1. En el panel de infactibles, expandir un componente con restricción "R6"
2. Explicar que el sistema priorizó docentes nombrados de mayor antigüedad
3. La sugerencia: "ampliar disponibilidad o reasignar"

### Demo 5 — Regeneración tras cambio de disponibilidad
1. Login como `docente@unt.edu.pe` → **Mi Disponibilidad**
2. Quitar algunos slots (ej. lunes mañana) → guardar
3. Volver como Director de Escuela → regenerar → el sistema reubica automáticamente

### Demo 6 — Reporte de infactibilidad
1. El horario ya muestra infactibles en el panel
2. Expandir uno → mostrar causa + sugerencias
3. *"El sistema no genera un horario incorrecto; reporta exactamente qué no pudo resolver y por qué"*

### Demo extra — Publicar y ver "Mi Horario"
1. Pulsar "Publicar Horario" → confirmar modal
2. Login como `docente@unt.edu.pe` → **Mi Horario**
3. Se muestra la grilla personal → pulsar "Descargar PDF"

---

## Reset de la demo

Para volver al estado inicial (borrar horario generado):

```bash
# Con curl (requiere token de admin)
curl -X POST "http://localhost:8000/api/admin/reset-demo" \
  -H "Authorization: Bearer <TOKEN>"
```

O directamente en la base de datos:
```sql
DELETE FROM horario_bloques;
UPDATE semestres SET estado = 'asignando';
```

---

## Endpoints principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/semestres/activo` | Semestre activo o publicado |
| POST | `/api/horario/generar?semestre_id=X` | Ejecuta el motor greedy |
| GET | `/api/horario/semestre/{id}/ciclo/{n}` | Bloques del ciclo N |
| POST | `/api/horario/validar-movimiento` | Valida mover un bloque (11 restricciones) |
| POST | `/api/horario/publicar?semestre_id=X` | Publica el horario |
| GET | `/api/horario/pdf/ciclo/{n}?semestre_id=X` | PDF de un ciclo |
| GET | `/api/horario/pdf/docente/{id}?semestre_id=X` | PDF personal del docente |
| GET | `/api/horario/pdf/completo?semestre_id=X` | PDF completo (todos los ciclos) |
| POST | `/api/admin/reset-demo` | Reset para re-demostrar |
